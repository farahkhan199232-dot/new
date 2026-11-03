# SplitChai in Fe

**Pitch:** SplitChai's USDC settlement contract, rewritten in Fe as a drop-in replacement for the Solidity version. It keeps the same ABI, passes the original Foundry suite unchanged, uses 2.4–7.2% less gas per settlement and has half the bytecode, and the Fe compiler proves its storage-access and reentrancy rules.

Fe Builders Challenge 2026 · project ID FE-002 · category: *Rethink a protocol*

## The problem

[SplitChai](https://splitchai.vercel.app) lets friend groups track shared expenses and settle up in USDC on Base in one tap. The money moves through one small contract. It pulls USDC from the payer and pushes it to the friend they owe, minus an optional fee of up to 1% for the treasury. It never holds funds. Production runs a Solidity version: [`0x4ce38dbb…fe15` on Base mainnet](https://basescan.org/address/0x4ce38dbb7eb76c9f801210dfc27c43bfd009fe15), verified on Sourcify.

Payment contracts like this are small, but their rules are easy to break:

- A storage value read before an external `transferFrom` may be stale after it if the token calls back in (reentrancy).
- Settle paths should never be able to touch admin state (owner, fee, treasury).
- Money and rates are both `uint256`/`uint16`, so nothing stops you from adding a fee rate to an amount.
- Hand-written selectors and ABI types can drift apart silently.

Solidity leaves all of these to code review. This project asks how much of them Fe can check at compile time, and what that costs in gas.

## Approach

During the contest I built:

1. **`src/lib.fe`**: a full Fe port of `SplitChaiSettlement`: `settle`, `settleBatch`, `quoteFee`, the views, a 1% fee cap, pause, and two-step ownership. Selectors, events and custom errors are byte-for-byte the Solidity ABI, so the existing frontend, indexer (`Settled` logs) and tests work against it unchanged.
2. **`src/money.fe`**: typed money. `Usdc` (an amount) and `Bps` (a fee rate) are distinct types. The only way to turn a rate into money is `Bps::of(Usdc) -> Usdc`, which rounds down exactly like the Solidity `quoteFee`.
3. **`src/tests.fe`**: 29 native `fe test` tests, including Fe test doubles (a mock USDC, a token that returns `false`, a token that re-enters, a second actor contract), a check that the reentrancy test fails when the lock is removed, and checks that go beyond the original suite: reentrancy, no-code token, unpause, lock release, zero treasury.
4. **`parity/`**: a differential harness. The original 18-test Foundry suite runs once against the Solidity contract and once against the Fe bytecode from `fe build`. Both pass all 18, including the 1,000-run fuzz test.
5. **`parity/test/GasBench.t.sol`**: a gas comparison under equal, cold-access conditions.
6. **A live deployment on Base Sepolia** and real `settle`/`settleBatch` transactions (see Demo).

## Fe highlight

### 1. The compiler refuses to hold storage across an external call

My first draft passed the storage-backed `config` into the function that calls the token's `transferFrom`. Fe rejected it:

```
error[16-0001]: access conflict in `fn SplitChaiSettlement::recv[0][0]`
    │
204 │   let fee = settle_one(config, group_id, from: ctx.caller(), to, amount: Usdc::units(amount), memo)
    │             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    │             │          │
    │             │          access opened here
    │             this call may write storage while a `ref` access of it is open
```

That is the reentrancy-staleness bug class, caught before any test ran. The fix is the pattern Fe pushes you toward: copy what the settlement needs out of storage once, then make the calls.

```fe
pub struct Terms { pub token: Address, pub treasury: Address, pub fee: Bps }

Settle { group_id, to, amount, memo } -> u256
uses (ctx, mut call, mut log, usdc, config, mut lock)   // `config` is read-only here
{
    enter(mut lock, config)
    let terms = config.terms(token: usdc)                // one snapshot, then external calls
    let fee = settle_one(terms, group_id, from: ctx.caller(), to, amount: Usdc::units(amount), memo)
    lock.write(false)
    fee.raw()
}
```

The snapshot is also where most of the batch gas saving comes from: one storage read for the whole batch instead of one per payment.

### 2. Effects make the permission map explicit

Every handler names exactly which state it reads (`config`) or writes (`mut config`). `Settle` and `SettleBatch` cannot write `config` or `ownership`, and only the `AdminMsg` handlers can. A future change that lets a settle path modify the fee fails to compile unless someone edits its `uses` line, where reviewers will see it. Messages are split into `SettlementMsg`, `ViewMsg` and `AdminMsg` groups, which read like three interfaces.

### 3. Selectors are type-checked

`#[selector = sol("settleBatch(bytes32,(address,uint256)[],bytes32)")]` is checked against the field types. When I tried `amount: Usdc`, the compiler pointed out that a user struct encodes as `(uint256)`, not `uint256`. With Solidity, that mismatch would have been a silent ABI break.

### 4. Typed money, a transient lock, and an immutable stored in code

- `Usdc + Bps` and `Usdc * Usdc` do not compile, and `Bps::of` is the single place fees are computed.
- The reentrancy guard is a `TSlot<bool>` (EIP-1153 transient storage), not a storage slot.
- The token address is an immutable field, which Fe keeps in the contract's code like a Solidity `immutable`.

## Architecture

```
src/lib.fe      contract SplitChaiSettlement
                ├─ msg SettlementMsg  settle / settleBatch / quoteFee
                ├─ msg ViewMsg        usdc / owner / pendingOwner / treasury / feeBps / paused / MAX_FEE_BPS
                ├─ msg AdminMsg       setFeeBps / setTreasury / setPaused / transferOwnership / acceptOwnership
                ├─ storage            usdc (immutable, in code) · config {treasury, fee, paused} · ownership {owner, pending} · lock (transient)
                ├─ enter()            lock + pause check  (Solidity's nonReentrant + whenNotPaused)
                ├─ settle_one()       validate → fee → pull(to) → pull(treasury) → emit Settled
                └─ pull()             std::evm::erc20::try_transfer_from; any failure → TransferFailed()
src/money.fe    Usdc, Bps, MAX_FEE, Bps::of, Solidity ABI impls (uint256 / uint16)
src/tests.fe    29 fe tests + Fe test doubles
parity/         Foundry: original suite × {Solidity, Fe} + gas benchmark
reference       parity/src/SplitChaiSettlement.sol = the deployed Solidity contract (unchanged)
```

Flow of a settlement: the payer approves the contract once (or batches approve+settle through a smart wallet), then calls `settle`. The contract pulls `amount - fee` to the recipient and `fee` to the treasury, then emits `Settled(groupId, from, to, amount, fee, memo)`.

## Build and test

```sh
fe --version            # fe 26.5.0 (3dab95f)
fe fmt --check
fe test                 # 29 passed
fe build                # out/SplitChaiSettlement.bin, .runtime.bin, .abi.json
```

Parity suite and gas benchmark (needs [Foundry](https://getfoundry.sh); run `fe build` first):

```sh
cd parity
forge install foundry-rs/forge-std --no-git   # once
forge test                                     # 37 passed: 18 Solidity + 18 Fe + gas report
forge test --match-contract GasBench -vv       # prints the gas table below
```

Install Fe with `curl -fsSL https://raw.githubusercontent.com/argotorg/fe/master/feup/feup.sh | bash -s -- --version v26.5.0`. CI (`.github/workflows/ci.yml`) runs fmt, `fe test`, `fe build` and the Foundry parity suite on every push.

## Gas: Fe vs Solidity

Solidity: solc 0.8.28, optimizer on, 10,000 runs, the exact settings of the deployed contract. Fe: 26.5.0, Sonatina backend. Each row runs on a fresh deployment with the contract and token cooled (`vm.cool`), so both pay cold-access costs as a real transaction would. Figures are execution gas of the external call.

| Call | Solidity | Fe | Fe vs Solidity |
|---|---:|---:|---:|
| settle (0.30% fee) | 60735 | 58992 | -2.86% |
| settle (no fee) | 53215 | 51913 | -2.44% |
| settleBatch x1 | 61688 | 59880 | -2.93% |
| settleBatch x3 | 90211 | 85761 | -4.93% |
| settleBatch x10 | 190067 | 176379 | -7.20% |
| quoteFee | 5476 | 5224 | -4.60% |
| setFeeBps | 32603 | 32469 | -0.41% |
| settle revert (ZeroAmount) | 33011 | 32507 | -1.52% |
| deploy (Fe figure includes reading the artifact) | 1002092 | 606605 | -39.46% |
| runtime bytecode (bytes) | 3894 | 1860 | |

On Base Sepolia, the real Fe deployment used 538,166 gas in total (`0x88fd44e5…`).

Where the savings come from, to be fair to Solidity:

- **Transient lock.** Fe's `TSlot` lock costs less than the original's storage `_locked` slot. Solidity can also use `transient`; the original simply doesn't.
- **Snapshot once per batch.** Fe's access rules forced it, and it is why the gap grows with batch size. A hand-optimized Solidity version could cache too.
- **Smaller code.** The Sonatina backend emits 52% less runtime bytecode, which is where the deploy saving comes from.

So the honest claim is this: the idiomatic Fe version, written the way the compiler pushes you, beats the idiomatic Solidity version we actually ship. It does not claim Fe codegen is 7% better instruction for instruction.

## Demo (Base Sepolia, chain 84532)

Deployed from a testnet-only burner wallet `0xf19AC42F…dDA6`:

| What | Address / tx |
|---|---|
| Fe `SplitChaiSettlement` bound to Circle test USDC `0x036CbD53…CF7e` (30 bps) | [`0x2e779fccf67685b4534d061e1163dee5ee9fcea5`](https://sepolia.basescan.org/address/0x2e779fccf67685b4534d061e1163dee5ee9fcea5) · deploy tx [`0x88fd44e5…6b9a`](https://sepolia.basescan.org/tx/0x88fd44e5d94fe531c8bda6b7a8974d369bda2baa0b93c0266ab7796e3afc6b9a) |
| Fe `MockUsdc` (test token, open mint) | [`0xed77871d8cdd62689321f7295aebf5f0bfe4b2b6`](https://sepolia.basescan.org/address/0xed77871d8cdd62689321f7295aebf5f0bfe4b2b6) |
| Fe `SplitChaiSettlement` bound to the test token | [`0x07811e44fd5666daa0eaa0e0a7b60a6b2409f890`](https://sepolia.basescan.org/address/0x07811e44fd5666daa0eaa0e0a7b60a6b2409f890) |
| `settle` 100 USDC → 0xb0b0, fee 0.30 | [`0xf3331a53…18a0`](https://sepolia.basescan.org/tx/0xf3331a53c2e1e0918616b36470f2c9702ef01f3a968dd82c759ced3046e718a0) (67,407 gas) |
| `settleBatch` 40 + 60 USDC | [`0x15ca678d…f65c`](https://sepolia.basescan.org/tx/0x15ca678d76ac07643970241875f1f2384a76ba7afbb31513ecf7c1bfc075f65c) (80,050 gas) |

The `Settled` log's topic0 is `0x1b0a7820…1360`, which is `keccak256("Settled(bytes32,address,address,uint256,uint256,bytes32)")`, the same as the Solidity event. SplitChai's usage indexer reads the Fe contract without changes.

Reproduce it yourself with `script/demo.sh` (Foundry `cast`, any funded Base Sepolia key).

## Limitations

- **Not audited and not on mainnet.** Production SplitChai still runs the Solidity contract. This port is a testnet-proven drop-in.
- **Stricter than the original on codeless tokens.** A call to an address with no code "succeeds" at the EVM level. The Solidity original treats that as success; the Fe port, via `std::evm::erc20::try_transfer_from`, reverts with `TransferFailed`. This is deliberate, safer, and covered by the `codeless_token_is_transfer_failed` test.
- **Typed money stops at the ABI boundary.** Message fields, events and views use `u256`/`u16`, and the handlers convert to `Usdc`/`Bps` right away. In Fe 26.5, a user-defined newtype can't stand for a Solidity `uint256` in a `sol("...")` selector (only std types like `Wei` are special-cased). A way to declare a user newtype "ABI-transparent" would let the types reach the interface.
- The Fe test runner has no `prank`, so tests that need another sender use small actor contracts. The Foundry parity suite covers the multi-sender cases with `vm.prank`.
- The gas numbers are L2 execution gas only. Base also charges an L1 data fee, which is the same for both versions on calls (identical calldata) and lower for the Fe deploy (smaller bytecode), but it isn't measured here.

## Declaration

- **Pre-existing work:** the Solidity contract `SplitChaiSettlement.sol` and its 18 Foundry tests were written on 27 Oct 2026, before the contest, for the live SplitChai app. They appear here unchanged as the reference (`parity/src/`), and the suite is adapted only to deploy through `_deploy(...)` (`parity/test/Parity.t.sol`). Everything in Fe (`fe.toml`, `src/*.fe`), the parity harness (`FeDeployer.sol`, the two concrete suites), the gas benchmark, the CI parity job, the deployments and this README were done during the contest window (from 3 Nov 2026). This branch starts empty (`fe-splitchai` is an orphan branch), so the full history is contest work.
- **Third-party code:** Fe standard library (`std::evm::erc20`, `TSlot`, `StorageMap`; Apache-2.0, part of the toolchain). [forge-std](https://github.com/foundry-rs/forge-std) (MIT/Apache-2.0), installed, not vendored. The CI workflow is adapted from [fe-lang/builders-challenge-starter](https://github.com/fe-lang/builders-challenge-starter) (Apache-2.0).
- **AI assistance:** written with the help of an AI agent (Hark), which wrote code, ran the compiler, tests and benchmarks, and drafted this README under the author's direction. Every claim here is backed by a test, a benchmark or an on-chain transaction that anyone can reproduce with the commands above. Farah Khan is the responsible human contact.

## Team

Farah Khan (solo): farahkhan199232@gmail.com

## License

MIT, see [LICENSE](LICENSE).
