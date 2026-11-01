//! Chai Pot on NEAR: a shared group pot where an AI agent pays the group's bills,
//! but only inside limits the members set and this contract enforces.
//!
//! Trust model
//! - Members deposit NEAR into a pot and file spend requests.
//! - The pot's `agent` account (an AI service holding only a function-call key
//!   scoped to `agent_review`) reviews each request. It can reject, or approve.
//! - An agent approval only pays out if the request is inside the pot's hard
//!   limits (allowed category, per-spend cap, daily cap, funds). Anything above a
//!   cap is escalated to member votes: the model can never move more money than
//!   the members allowed, even if it is wrong or compromised.
//! - Members other than the requester approve escalated spends; at
//!   `approvals_needed` approvals the payout is sent.
//! - Members can withdraw their unspent share at any time.

use near_sdk::json_types::{U128, U64};
use near_sdk::store::LookupMap;
use near_sdk::{
    env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
};

const NS_PER_DAY: u64 = 86_400_000_000_000;
const MAX_MEMBERS: usize = 12;
const MAX_CATEGORIES: usize = 12;
const MAX_TEXT: usize = 280;
const GAS_FOR_CALLBACK: Gas = Gas::from_tgas(10);

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Pots,
    Spends,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub enum SpendStatus {
    /// Filed by a member, waiting for the agent.
    PendingAgent,
    /// Agent approved but the amount is above a cap: needs member approvals.
    NeedsVotes,
    /// Payout sent and confirmed.
    Paid,
    /// Rejected by the agent, a member, or the contract's checks.
    Rejected,
    /// Payout transfer failed (e.g. recipient account does not exist); funds returned to the pot.
    Failed,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Spend {
    pub id: u64,
    pub requester: AccountId,
    pub to: AccountId,
    pub amount: U128,
    pub category: String,
    pub memo: String,
    pub status: SpendStatus,
    /// The agent's (or member's) one-line reason for its decision.
    pub reason: String,
    /// sha256 of the model's full JSON verdict, so the off-chain AI log can be audited against chain.
    pub verdict_hash: String,
    pub approvals: Vec<AccountId>,
    pub created_at: U64,
    pub decided_at: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Contribution {
    pub account: AccountId,
    pub deposited: U128,
    pub withdrawn: U128,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug)]
pub struct Pot {
    pub id: u64,
    pub name: String,
    pub creator: AccountId,
    pub members: Vec<AccountId>,
    pub agent: AccountId,
    pub per_spend_cap: U128,
    pub daily_cap: U128,
    pub approvals_needed: u8,
    pub categories: Vec<String>,
    /// Unspent NEAR held for this pot (yoctoNEAR).
    pub balance: U128,
    /// Total paid out to bills (yoctoNEAR).
    pub spent_total: U128,
    pub spent_today: U128,
    /// Day index (block_timestamp / 1 day) that `spent_today` refers to.
    pub day: U64,
    pub contributions: Vec<Contribution>,
    pub spend_count: u64,
    pub created_at: U64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ChaiPot {
    pots: LookupMap<u64, Pot>,
    spends: LookupMap<(u64, u64), Spend>,
    pot_count: u64,
}

fn clean_text(s: &str, field: &str) -> String {
    let t = s.trim().to_string();
    require!(t.len() <= MAX_TEXT, format!("{field} too long"));
    t
}

#[near]
impl ChaiPot {
    #[init]
    pub fn new() -> Self {
        Self {
            pots: LookupMap::new(StorageKey::Pots),
            spends: LookupMap::new(StorageKey::Spends),
            pot_count: 0,
        }
    }

    // ---------------------------------------------------------------- pots

    /// Create a pot. The caller becomes a member. Returns the pot id.
    pub fn create_pot(
        &mut self,
        name: String,
        members: Vec<AccountId>,
        agent: AccountId,
        per_spend_cap: U128,
        daily_cap: U128,
        approvals_needed: u8,
        categories: Vec<String>,
    ) -> u64 {
        let creator = env::predecessor_account_id();
        let name = clean_text(&name, "name");
        require!(!name.is_empty(), "name required");
        let mut all = vec![creator.clone()];
        for m in members {
            if !all.contains(&m) {
                all.push(m);
            }
        }
        require!(all.len() <= MAX_MEMBERS, "too many members");
        require!(!all.contains(&agent), "agent cannot be a member");
        require!(per_spend_cap.0 > 0 && daily_cap.0 >= per_spend_cap.0, "daily cap must be >= per-spend cap > 0");
        require!(approvals_needed >= 1, "approvals_needed must be >= 1");
        require!(
            (approvals_needed as usize) < all.len(),
            "approvals_needed must be less than the number of members"
        );
        require!(!categories.is_empty() && categories.len() <= MAX_CATEGORIES, "1-12 categories");
        let categories: Vec<String> = categories.iter().map(|c| clean_text(&c.to_lowercase(), "category")).collect();

        let id = self.pot_count;
        self.pot_count += 1;
        let now = env::block_timestamp();
        let pot = Pot {
            id,
            name,
            creator,
            contributions: all
                .iter()
                .map(|a| Contribution { account: a.clone(), deposited: U128(0), withdrawn: U128(0) })
                .collect(),
            members: all,
            agent,
            per_spend_cap,
            daily_cap,
            approvals_needed,
            categories,
            balance: U128(0),
            spent_total: U128(0),
            spent_today: U128(0),
            day: U64(now / NS_PER_DAY),
            spend_count: 0,
            created_at: U64(now),
        };
        env::log_str(&format!("EVENT_JSON:{{\"event\":\"pot_created\",\"pot\":{id}}}"));
        self.pots.insert(id, pot);
        id
    }

    /// Chip in: attach NEAR to add it to the pot. Members only.
    #[payable]
    pub fn deposit(&mut self, pot_id: u64) -> U128 {
        let who = env::predecessor_account_id();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "attach NEAR to deposit");
        let mut pot = self.pot(pot_id);
        require!(pot.members.contains(&who), "only members can deposit");
        pot.balance = U128(pot.balance.0 + amount);
        let c = pot.contributions.iter_mut().find(|c| c.account == who).unwrap();
        c.deposited = U128(c.deposited.0 + amount);
        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"deposit\",\"pot\":{pot_id},\"from\":\"{who}\",\"amount\":\"{amount}\"}}"
        ));
        let bal = pot.balance;
        self.pots.insert(pot_id, pot);
        bal
    }

    /// Withdraw up to your unspent share (deposits - withdrawals - equal share of paid bills).
    pub fn withdraw(&mut self, pot_id: u64, amount: U128) -> Promise {
        let who = env::predecessor_account_id();
        let mut pot = self.pot(pot_id);
        require!(pot.members.contains(&who), "only members can withdraw");
        let available = Self::available_for(&pot, &who);
        require!(amount.0 > 0 && amount.0 <= available, "amount exceeds your unspent share");
        require!(amount.0 <= pot.balance.0, "pot balance too low");
        pot.balance = U128(pot.balance.0 - amount.0);
        let c = pot.contributions.iter_mut().find(|c| c.account == who).unwrap();
        c.withdrawn = U128(c.withdrawn.0 + amount.0);
        self.pots.insert(pot_id, pot);
        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"withdraw\",\"pot\":{pot_id},\"to\":\"{who}\",\"amount\":\"{}\"}}",
            amount.0
        ));
        Promise::new(who).transfer(NearToken::from_yoctonear(amount.0))
    }

    // -------------------------------------------------------------- spends

    /// File a spend request. Members only. The agent reviews it next.
    pub fn request_spend(&mut self, pot_id: u64, to: AccountId, amount: U128, category: String, memo: String) -> u64 {
        let who = env::predecessor_account_id();
        let mut pot = self.pot(pot_id);
        require!(pot.members.contains(&who), "only members can request spends");
        require!(amount.0 > 0, "amount must be > 0");
        require!(to != env::current_account_id(), "cannot pay the pot contract");
        let id = pot.spend_count;
        pot.spend_count += 1;
        let spend = Spend {
            id,
            requester: who,
            to,
            amount,
            category: clean_text(&category.to_lowercase(), "category"),
            memo: clean_text(&memo, "memo"),
            status: SpendStatus::PendingAgent,
            reason: String::new(),
            verdict_hash: String::new(),
            approvals: vec![],
            created_at: U64(env::block_timestamp()),
            decided_at: U64(0),
        };
        self.spends.insert((pot_id, id), spend);
        self.pots.insert(pot_id, pot);
        env::log_str(&format!("EVENT_JSON:{{\"event\":\"spend_requested\",\"pot\":{pot_id},\"spend\":{id}}}"));
        id
    }

    /// The AI agent's decision. Only the pot's agent account can call this.
    /// `approve = true` pays out only if every hard limit holds; above a cap it
    /// escalates to member votes; a broken hard rule (category, funds) rejects.
    pub fn agent_review(
        &mut self,
        pot_id: u64,
        spend_id: u64,
        approve: bool,
        reason: String,
        verdict_hash: String,
    ) -> SpendStatus {
        let mut pot = self.pot(pot_id);
        require!(env::predecessor_account_id() == pot.agent, "only the pot's agent can review");
        let mut spend = self.spend(pot_id, spend_id);
        require!(spend.status == SpendStatus::PendingAgent, "spend is not waiting for the agent");
        spend.reason = clean_text(&reason, "reason");
        spend.verdict_hash = clean_text(&verdict_hash, "verdict_hash");
        spend.decided_at = U64(env::block_timestamp());

        if !approve {
            spend.status = SpendStatus::Rejected;
        } else {
            Self::roll_day(&mut pot);
            match Self::hard_check(&pot, &spend) {
                Err(why) => {
                    spend.status = SpendStatus::Rejected;
                    spend.reason = format!("contract: {why}");
                }
                Ok(within_caps) => {
                    if within_caps {
                        return self.pay(pot, spend);
                    }
                    spend.status = SpendStatus::NeedsVotes;
                }
            }
        }
        let status = spend.status.clone();
        self.spends.insert((pot_id, spend_id), spend);
        self.pots.insert(pot_id, pot);
        status
    }

    /// A member (not the requester) approves an escalated spend. Pays out at the threshold.
    pub fn approve_spend(&mut self, pot_id: u64, spend_id: u64) -> SpendStatus {
        let who = env::predecessor_account_id();
        let mut pot = self.pot(pot_id);
        require!(pot.members.contains(&who), "only members can approve");
        let mut spend = self.spend(pot_id, spend_id);
        require!(spend.status == SpendStatus::NeedsVotes, "spend is not waiting for votes");
        require!(spend.requester != who, "requester cannot approve their own spend");
        require!(!spend.approvals.contains(&who), "already approved");
        spend.approvals.push(who);
        if spend.approvals.len() >= pot.approvals_needed as usize {
            Self::roll_day(&mut pot);
            // Members can lift the caps, but never the category rule or the pot's funds.
            if let Err(why) = Self::hard_check(&pot, &spend) {
                spend.status = SpendStatus::Rejected;
                spend.reason = format!("contract: {why}");
                spend.decided_at = U64(env::block_timestamp());
                let s = spend.status.clone();
                self.spends.insert((pot_id, spend_id), spend);
                self.pots.insert(pot_id, pot);
                return s;
            }
            return self.pay(pot, spend);
        }
        self.spends.insert((pot_id, spend_id), spend);
        SpendStatus::NeedsVotes
    }

    /// A member (not the requester) vetoes an escalated spend.
    pub fn reject_spend(&mut self, pot_id: u64, spend_id: u64, reason: String) -> SpendStatus {
        let who = env::predecessor_account_id();
        let pot = self.pot(pot_id);
        require!(pot.members.contains(&who), "only members can reject");
        let mut spend = self.spend(pot_id, spend_id);
        require!(
            spend.status == SpendStatus::NeedsVotes || spend.status == SpendStatus::PendingAgent,
            "spend already decided"
        );
        require!(spend.requester != who || spend.status == SpendStatus::PendingAgent, "use a vote from another member");
        spend.status = SpendStatus::Rejected;
        spend.reason = format!("{who}: {}", clean_text(&reason, "reason"));
        spend.decided_at = U64(env::block_timestamp());
        self.spends.insert((pot_id, spend_id), spend);
        SpendStatus::Rejected
    }

    #[private]
    pub fn on_payout(&mut self, pot_id: u64, spend_id: u64) -> SpendStatus {
        let ok = env::promise_result_checked(0, 64).is_ok();
        let mut spend = self.spend(pot_id, spend_id);
        if ok {
            return SpendStatus::Paid;
        }
        // Transfer failed: put the money back.
        let mut pot = self.pot(pot_id);
        pot.balance = U128(pot.balance.0 + spend.amount.0);
        pot.spent_total = U128(pot.spent_total.0.saturating_sub(spend.amount.0));
        if pot.day.0 == spend.decided_at.0 / NS_PER_DAY {
            pot.spent_today = U128(pot.spent_today.0.saturating_sub(spend.amount.0));
        }
        spend.status = SpendStatus::Failed;
        spend.reason = format!("{} (payout transfer failed, refunded to pot)", spend.reason);
        self.pots.insert(pot_id, pot);
        self.spends.insert((pot_id, spend_id), spend);
        SpendStatus::Failed
    }

    // --------------------------------------------------------------- views

    pub fn get_pot(&self, pot_id: u64) -> Option<Pot> {
        self.pots.get(&pot_id).cloned()
    }

    pub fn get_pot_count(&self) -> u64 {
        self.pot_count
    }

    /// Newest first.
    pub fn get_spends(&self, pot_id: u64, from_index: Option<u64>, limit: Option<u64>) -> Vec<Spend> {
        let Some(pot) = self.pots.get(&pot_id) else { return vec![] };
        let limit = limit.unwrap_or(50).min(100);
        let skip = from_index.unwrap_or(0);
        (0..pot.spend_count)
            .rev()
            .skip(skip as usize)
            .take(limit as usize)
            .filter_map(|i| self.spends.get(&(pot_id, i)).cloned())
            .collect()
    }

    pub fn get_spend(&self, pot_id: u64, spend_id: u64) -> Option<Spend> {
        self.spends.get(&(pot_id, spend_id)).cloned()
    }

    /// How much `account` could withdraw now.
    pub fn get_available(&self, pot_id: u64, account: AccountId) -> U128 {
        let pot = self.pot(pot_id);
        U128(Self::available_for(&pot, &account).min(pot.balance.0))
    }

    // ------------------------------------------------------------- helpers

    fn pot(&self, pot_id: u64) -> Pot {
        self.pots.get(&pot_id).cloned().unwrap_or_else(|| env::panic_str("no such pot"))
    }

    fn spend(&self, pot_id: u64, spend_id: u64) -> Spend {
        self.spends.get(&(pot_id, spend_id)).cloned().unwrap_or_else(|| env::panic_str("no such spend"))
    }

    fn roll_day(pot: &mut Pot) {
        let today = env::block_timestamp() / NS_PER_DAY;
        if pot.day.0 != today {
            pot.day = U64(today);
            pot.spent_today = U128(0);
        }
    }

    /// Err = must reject. Ok(true) = inside both caps. Ok(false) = valid but above a cap.
    fn hard_check(pot: &Pot, spend: &Spend) -> Result<bool, String> {
        if !pot.categories.contains(&spend.category) {
            return Err(format!("category '{}' not allowed", spend.category));
        }
        if spend.amount.0 > pot.balance.0 {
            return Err("not enough money in the pot".into());
        }
        let within = spend.amount.0 <= pot.per_spend_cap.0 && pot.spent_today.0 + spend.amount.0 <= pot.daily_cap.0;
        Ok(within)
    }

    fn available_for(pot: &Pot, who: &AccountId) -> u128 {
        let Some(c) = pot.contributions.iter().find(|c| &c.account == who) else { return 0 };
        let share = pot.spent_total.0 / pot.members.len() as u128;
        c.deposited.0.saturating_sub(c.withdrawn.0).saturating_sub(share)
    }

    fn pay(&mut self, mut pot: Pot, mut spend: Spend) -> SpendStatus {
        let amount = spend.amount.0;
        pot.balance = U128(pot.balance.0 - amount);
        pot.spent_total = U128(pot.spent_total.0 + amount);
        pot.spent_today = U128(pot.spent_today.0 + amount);
        spend.status = SpendStatus::Paid;
        spend.decided_at = U64(env::block_timestamp());
        let (pot_id, spend_id, to) = (pot.id, spend.id, spend.to.clone());
        env::log_str(&format!(
            "EVENT_JSON:{{\"event\":\"spend_paid\",\"pot\":{pot_id},\"spend\":{spend_id},\"to\":\"{to}\",\"amount\":\"{amount}\"}}"
        ));
        self.pots.insert(pot_id, pot);
        self.spends.insert((pot_id, spend_id), spend);
        Promise::new(to)
            .transfer(NearToken::from_yoctonear(amount))
            .then(Self::ext(env::current_account_id()).with_static_gas(GAS_FOR_CALLBACK).on_payout(pot_id, spend_id))
            .detach();
        SpendStatus::Paid
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;

    const ONE: u128 = 1_000_000_000_000_000_000_000_000;

    fn acc(s: &str) -> AccountId {
        s.parse().unwrap()
    }

    fn ctx(who: &str, deposit: u128) {
        let mut b = VMContextBuilder::new();
        b.current_account_id(acc("pot.testnet"))
            .predecessor_account_id(acc(who))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(1_800_000_000_000_000_000);
        testing_env!(b.build());
    }

    fn setup() -> (ChaiPot, u64) {
        ctx("asha.testnet", 0);
        let mut c = ChaiPot::new();
        let id = c.create_pot(
            "Goa trip".into(),
            vec![acc("ravi.testnet"), acc("meera.testnet")],
            acc("agent.testnet"),
            U128(2 * ONE),
            U128(3 * ONE),
            1,
            vec!["food".into(), "transport".into()],
        );
        for m in ["asha.testnet", "ravi.testnet", "meera.testnet"] {
            ctx(m, 3 * ONE);
            c.deposit(id);
        }
        (c, id)
    }

    fn request(c: &mut ChaiPot, id: u64, who: &str, amount: u128, cat: &str) -> u64 {
        ctx(who, 0);
        c.request_spend(id, acc("cafe.testnet"), U128(amount), cat.into(), "dinner".into())
    }

    fn review(c: &mut ChaiPot, id: u64, s: u64, ok: bool) -> SpendStatus {
        ctx("agent.testnet", 0);
        c.agent_review(id, s, ok, "ok".into(), "abc".into())
    }

    #[test]
    fn create_and_deposit() {
        let (c, id) = setup();
        let p = c.get_pot(id).unwrap();
        assert_eq!(p.members.len(), 3);
        assert_eq!(p.balance.0, 9 * ONE);
    }

    #[test]
    #[should_panic(expected = "only members can deposit")]
    fn outsider_cannot_deposit() {
        let (mut c, id) = setup();
        ctx("eve.testnet", ONE);
        c.deposit(id);
    }

    #[test]
    fn within_caps_auto_pays() {
        let (mut c, id) = setup();
        let s = request(&mut c, id, "ravi.testnet", ONE, "food");
        assert_eq!(review(&mut c, id, s, true), SpendStatus::Paid);
        let p = c.get_pot(id).unwrap();
        assert_eq!(p.balance.0, 8 * ONE);
        assert_eq!(p.spent_today.0, ONE);
    }

    #[test]
    fn above_cap_escalates_then_member_vote_pays() {
        let (mut c, id) = setup();
        let s = request(&mut c, id, "ravi.testnet", 5 * ONE / 2, "food");
        assert_eq!(review(&mut c, id, s, true), SpendStatus::NeedsVotes);
        assert_eq!(c.get_pot(id).unwrap().balance.0, 9 * ONE);
        ctx("meera.testnet", 0);
        assert_eq!(c.approve_spend(id, s), SpendStatus::Paid);
        assert_eq!(c.get_pot(id).unwrap().balance.0, 9 * ONE - 5 * ONE / 2);
    }

    #[test]
    fn daily_cap_escalates() {
        let (mut c, id) = setup();
        let a = request(&mut c, id, "ravi.testnet", 2 * ONE, "food");
        assert_eq!(review(&mut c, id, a, true), SpendStatus::Paid);
        let b = request(&mut c, id, "ravi.testnet", 2 * ONE, "transport");
        assert_eq!(review(&mut c, id, b, true), SpendStatus::NeedsVotes);
    }

    #[test]
    fn disallowed_category_rejected_even_if_agent_approves() {
        let (mut c, id) = setup();
        let s = request(&mut c, id, "ravi.testnet", ONE, "casino");
        assert_eq!(review(&mut c, id, s, true), SpendStatus::Rejected);
        assert!(c.get_spend(id, s).unwrap().reason.starts_with("contract:"));
    }

    #[test]
    fn agent_reject() {
        let (mut c, id) = setup();
        let s = request(&mut c, id, "ravi.testnet", ONE, "food");
        assert_eq!(review(&mut c, id, s, false), SpendStatus::Rejected);
        assert_eq!(c.get_pot(id).unwrap().balance.0, 9 * ONE);
    }

    #[test]
    #[should_panic(expected = "only the pot's agent can review")]
    fn only_agent_reviews() {
        let (mut c, id) = setup();
        let s = request(&mut c, id, "ravi.testnet", ONE, "food");
        ctx("ravi.testnet", 0);
        c.agent_review(id, s, true, "me".into(), "x".into());
    }

    #[test]
    #[should_panic(expected = "requester cannot approve their own spend")]
    fn requester_cannot_self_approve() {
        let (mut c, id) = setup();
        let s = request(&mut c, id, "ravi.testnet", 5 * ONE / 2, "food");
        review(&mut c, id, s, true);
        ctx("ravi.testnet", 0);
        c.approve_spend(id, s);
    }

    #[test]
    fn withdraw_capped_at_unspent_share() {
        let (mut c, id) = setup();
        let s = request(&mut c, id, "ravi.testnet", 3 * ONE / 2, "food");
        review(&mut c, id, s, true);
        // each member's share of 1.5 NEAR = 0.5 NEAR; asha deposited 3 -> 2.5 available
        assert_eq!(c.get_available(id, acc("asha.testnet")).0, 5 * ONE / 2);
        ctx("asha.testnet", 0);
        let _ = c.withdraw(id, U128(5 * ONE / 2));
        assert_eq!(c.get_available(id, acc("asha.testnet")).0, 0);
    }

    #[test]
    #[should_panic(expected = "amount exceeds your unspent share")]
    fn cannot_over_withdraw() {
        let (mut c, id) = setup();
        ctx("asha.testnet", 0);
        let _ = c.withdraw(id, U128(4 * ONE));
    }

    #[test]
    fn member_veto() {
        let (mut c, id) = setup();
        let s = request(&mut c, id, "ravi.testnet", 5 * ONE / 2, "food");
        review(&mut c, id, s, true);
        ctx("asha.testnet", 0);
        assert_eq!(c.reject_spend(id, s, "too pricey".into()), SpendStatus::Rejected);
    }
}
