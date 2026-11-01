import type { Ev, Group } from "./shg.ts";
import { applyEvent, balanceText, checkLoan, computeState, groupSummary, inr } from "./shg.ts";

/**
 * The agent: turns what the treasurer types or says (Hindi, Marathi-style Hinglish or English)
 * into ONE proposed ledger entry. The language model only interprets the words; every number,
 * limit and rule is checked by the deterministic engine in shg.ts, and nothing is written until
 * an office bearer taps Confirm.
 */

export type Intent = {
  intent: "contribution" | "loan_request" | "repayment" | "approve" | "reject" | "balance" | "summary" | "unknown";
  memberId: string | null;
  amount: number | null;
  tenureMonths: number | null;
  purpose: string | null;
  loanId: string | null;
  lang: "hi" | "en";
  note: string;
};

export type AgentReply = {
  parsedBy: string;
  intent: Intent;
  en: string;
  hi: string;
  proposal: Ev | null; // entry awaiting Confirm
  blocked: boolean; // rules said no
};

const KEY = process.env.GEMINI_API_KEY;
const MODELS = [process.env.GEMINI_MODEL || "gemini-3.8-flash", ...(process.env.GEMINI_FALLBACK_MODELS || "gemini-2.5-flash-lite").split(",").map((s) => s.trim()).filter(Boolean)];

const schema = {
  type: "OBJECT",
  properties: {
    intent: { type: "STRING", enum: ["contribution", "loan_request", "repayment", "approve", "reject", "balance", "summary", "unknown"] },
    memberId: { type: "STRING", nullable: true, description: "id of the member the message is about, from the list" },
    amount: { type: "NUMBER", nullable: true, description: "rupees" },
    tenureMonths: { type: "NUMBER", nullable: true },
    purpose: { type: "STRING", nullable: true, description: "loan purpose in short English" },
    loanId: { type: "STRING", nullable: true },
    lang: { type: "STRING", enum: ["hi", "en"], description: "hi if the message is Hindi/Marathi/Hinglish, else en" },
    note: { type: "STRING", description: "anything unclear, else empty" },
  },
  required: ["intent", "lang", "note"],
};

function systemPrompt(g: Group, month: string): string {
  const st = computeState(g, month);
  const members = g.members.map((m) => `${m.id}: ${m.name} / ${m.nameHi} (${m.role})`).join("\n");
  const loans = st.loans.filter((l) => l.status === "pending" || l.status === "approved")
    .map((l) => `${l.loanId}: ${l.memberId} ₹${l.amount} ${l.status}`).join("\n") || "none";
  return `You read messages from the treasurer of an Indian women's self-help group (SHG) savings pot and extract ONE action.
Messages may be Hindi (Devanagari), Marathi, Hinglish in Latin script, or English, often from voice typing. "jama", "bachat", "diye" = contribution. "loan", "karz", "udhaar", "chahiye" = loan_request. "kist", "wapas", "bhara", "repay" = repayment. "manjoor", "approve" = approve. "nahi", "reject" = reject. "kitna", "balance", "hisaab" about one person = balance; about the group/"sabka"/"group" = summary.
Members (id: English / Hindi name, role):\n${members}\nOpen loans:\n${loans}\nMonthly saving is ₹${g.rules.monthlySaving}. If a contribution has no amount, use ${g.rules.monthlySaving}. For repayment/approve/reject without a loan id, use that member's open loan id. Never invent a member: if the name matches nobody, memberId null and say so in note.`;
}

async function llm(text: string, g: Group, month: string): Promise<(Intent & { _model: string }) | null> {
  if (!KEY) return null;
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt(g, month) }] },
          contents: [{ role: "user", parts: [{ text }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: schema,
            ...(/gemini-3/.test(model) ? { thinkingConfig: { thinkingLevel: "low" } } : {}) },
        }),
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!r.ok) continue;
      const d = await r.json();
      const out = d.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
      if (out) return { ...(JSON.parse(out) as Intent), _model: model };
    } catch {
      /* try next model */
    }
  }
  return null;
}

const DEV_DIGITS = "०१२३४५६७८९";
const normDigits = (s: string) => s.replace(/[०-९]/g, (c) => String(DEV_DIGITS.indexOf(c)));

/** Keyword fallback so the demo works offline or if the model is down. */
export function ruleParse(text: string, g: Group, month: string): Intent {
  const t = normDigits(text).toLowerCase();
  const hi = /[\u0900-\u097F]/.test(text) || /\b(ne|ka|ki|ko|jama|diye|chahiye|kitna|kist|mahine|rupaye|udhaar|karz)\b/.test(t);
  const member = g.members.find((m) => {
    const first = m.name.split(" ")[0].toLowerCase();
    return t.includes(first) || text.includes(m.nameHi.split(" ")[0]);
  });
  const nums = [...t.matchAll(/(\d[\d,]*)/g)].map((x) => Number(x[1].replace(/,/g, "")));
  const tenureM = t.match(/(\d+)\s*(months?|mahin[ea]|महीन[ेा])/);
  const tenure = tenureM ? Number(tenureM[1]) : null;
  const amount = nums.find((n) => n !== tenure) ?? null;
  const open = member ? computeState(g, month).loans.find((l) => l.memberId === member.id && (l.status === "pending" || l.status === "approved")) : undefined;
  let intent: Intent["intent"] = "unknown";
  if (/(approve|manjoor|मंजूर)/.test(t)) intent = "approve";
  else if (/(reject|namanjoor|नामंजूर)/.test(t)) intent = "reject";
  else if (/(repay|kist|किस्त|wapas|वापस|bhara|भरा)/.test(t)) intent = "repayment";
  else if (/(loan|udhaar|udhar|उधार|karz|कर्ज|chahiye|चाहिए)/.test(t)) intent = "loan_request";
  else if (/(jama|जमा|bachat|बचत|diye|दिए|paid|saving|contribut)/.test(t)) intent = "contribution";
  else if (/(group|sabka|सबका|समूह|summary|hisaab|हिसाब)/.test(t) && !member) intent = "summary";
  else if (/(balance|kitna|कितना|baki|बाकी)/.test(t)) intent = member ? "balance" : "summary";
  return {
    intent, memberId: member?.id ?? null,
    amount: intent === "contribution" ? amount ?? g.rules.monthlySaving : amount,
    tenureMonths: tenure, purpose: null, loanId: open?.loanId ?? null, lang: hi ? "hi" : "en", note: "",
  };
}

export async function interpret(text: string, g: Group, month: string, by: string, ids: { ev: string; loan: string }): Promise<AgentReply> {
  const viaLlm = await llm(text, g, month);
  const intent: Intent = viaLlm ?? ruleParse(text, g, month);
  const parsedBy = viaLlm ? viaLlm._model : "keyword rules (AI offline)";
  const m = g.members.find((x) => x.id === intent.memberId);
  const at = new Date().toISOString();
  const say = (en: string, hi: string, proposal: Ev | null = null, blocked = false): AgentReply => ({ parsedBy, intent, en, hi, proposal, blocked });
  const needMember = () => say("Which member? I could not match the name to anyone in the group.", "किस सदस्य की बात है? यह नाम समूह में नहीं मिला।");

  const tryEv = (ev: Ev, en: string, hi: string) => {
    try {
      applyEvent(g, ev); // dry run: engine validates, nothing saved
      return say(en, hi, ev);
    } catch (e) {
      return say(`Can't record this: ${(e as Error).message}`, `यह दर्ज नहीं हो सकता: ${(e as Error).message}`, null, true);
    }
  };

  switch (intent.intent) {
    case "summary":
      return say(groupSummary(g, month, "en"), groupSummary(g, month, "hi"));
    case "balance":
      return m ? say(balanceText(g, m.id, month, "en"), balanceText(g, m.id, month, "hi")) : needMember();
    case "contribution": {
      if (!m) return needMember();
      const amt = Math.round(intent.amount ?? g.rules.monthlySaving);
      return tryEv({ id: ids.ev, at, by, month, type: "contribution", memberId: m.id, amount: amt },
        `Record ${inr(amt)} saving from ${m.name} for this month?`, `${m.nameHi} की इस महीने की बचत ${inr(amt)} दर्ज करें?`);
    }
    case "loan_request": {
      if (!m) return needMember();
      const amt = Math.round(intent.amount ?? 0);
      const tenure = Math.round(intent.tenureMonths ?? Math.min(10, g.rules.maxTenureMonths));
      const c = checkLoan(g, m.id, amt, tenure, month);
      if (!c.ok) {
        const onlyAmount = c.problems.every((p) => p.code === "over_multiple" || p.code === "over_cash");
        const lim = onlyAmount && c.maxEligible > 0 ? ` Most she can borrow now: ${inr(c.maxEligible)}.` : "";
        const limHi = onlyAmount && c.maxEligible > 0 ? ` अभी अधिकतम ${inr(c.maxEligible)} मिल सकता है।` : "";
        return say(`No, by the group's rules: ${c.problems.map((p) => p.en).join(" ")}${lim}`,
          `नहीं, समूह के नियम के अनुसार: ${c.problems.map((p) => p.hi).join(" ")}${limHi}`, null, true);
      }
      const first = c.plan[0];
      return say(
        `${m.name} can get ${inr(amt)} for ${tenure} months. She pays about ${inr(first.total)} in month 1 (${inr(first.principal)} + ${inr(first.interest)} interest), less each month after. Needs ${g.rules.approvalsNeeded} approvals from leader/treasurer. Record the request?`,
        `${m.nameHi} को ${inr(amt)} ${tenure} महीने के लिए मिल सकता है। पहले महीने लगभग ${inr(first.total)} (${inr(first.principal)} + ${inr(first.interest)} ब्याज), फिर हर महीने कम। अध्यक्ष/कोषाध्यक्ष की ${g.rules.approvalsNeeded} मंज़ूरी चाहिए। माँग दर्ज करें?`,
        { id: ids.ev, at, by, month, type: "loan_request", loanId: ids.loan, memberId: m.id, amount: amt, tenureMonths: tenure, purpose: intent.purpose || "not given" },
      );
    }
    case "repayment":
    case "approve":
    case "reject": {
      const st = computeState(g, month);
      const loan = st.loans.find((l) => l.loanId === intent.loanId) ??
        st.loans.find((l) => l.memberId === intent.memberId && (intent.intent === "repayment" ? l.status === "approved" : l.status === "pending"));
      if (!loan) return say("I couldn't find an open loan for that member.", "उस सदस्य का कोई खुला उधार नहीं मिला।");
      const bm = g.members.find((x) => x.id === loan.memberId)!;
      if (intent.intent === "repayment") {
        const amt = Math.round(intent.amount ?? loan.nextDue?.total ?? 0);
        return tryEv({ id: ids.ev, at, by, month, type: "repayment", loanId: loan.loanId, amount: amt },
          `Record ${inr(amt)} loan payment from ${bm.name}? Interest is paid first, the rest cuts her loan (${inr(loan.principalOutstanding)} left now).`,
          `${bm.nameHi} की ${inr(amt)} किस्त दर्ज करें? पहले ब्याज कटेगा, बाकी से उधार घटेगा (अभी ${inr(loan.principalOutstanding)} बाकी)।`);
      }
      if (intent.intent === "approve")
        return tryEv({ id: ids.ev, at, by, month, type: "loan_approve", loanId: loan.loanId },
          `Approve ${bm.name}'s loan of ${inr(loan.amount)}? (${loan.approvals.length} of ${g.rules.approvalsNeeded} approvals so far)`,
          `${bm.nameHi} का ${inr(loan.amount)} उधार मंज़ूर करें? (अब तक ${loan.approvals.length}/${g.rules.approvalsNeeded} मंज़ूरी)`);
      return tryEv({ id: ids.ev, at, by, month, type: "loan_reject", loanId: loan.loanId, reason: intent.note || "group decision" },
        `Reject ${bm.name}'s loan request of ${inr(loan.amount)}?`, `${bm.nameHi} की ${inr(loan.amount)} उधार माँग नामंज़ूर करें?`);
    }
    default:
      return say(
        `Sorry, I didn't understand. Try: "Lata ne 200 jama kiye", "Asha ko 3000 ka loan 6 mahine", "Sunita ka balance", "group ka hisaab".`,
        `माफ़ कीजिए, समझ नहीं आया। ऐसे लिखें: "लता ने 200 जमा किए", "आशा को 3000 का उधार 6 महीने", "सुनीता का बैलेंस", "समूह का हिसाब"।`,
      );
  }
}
