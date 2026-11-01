"use client";

import { actionCreators, setupWalletSelector, type WalletSelector } from "@near-wallet-selector/core";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { NEAR_CONTRACT, NEAR_NETWORK } from "@/lib/near/config";
import { returnValue } from "@/lib/near/view";

/**
 * NEAR Wallet Selector (testnet). Users sign their own transactions in their wallet;
 * Chai Pot never sees their keys.
 */
let sel: Promise<WalletSelector> | null = null;

export function selector() {
  sel ??= setupWalletSelector({ network: NEAR_NETWORK, modules: [setupMyNearWallet(), setupMeteorWallet()] });
  return sel;
}

export async function showSignIn() {
  const s = await selector();
  setupModal(s, { contractId: NEAR_CONTRACT, description: "Sign in with a NEAR testnet wallet. Chai Pot never sees your keys." }).show();
}

export async function activeAccount(): Promise<string | null> {
  const s = await selector();
  return s.store.getState().accounts.find((a) => a.active)?.accountId ?? null;
}

export async function onAccountChange(cb: (id: string | null) => void) {
  const s = await selector();
  return s.store.observable.subscribe((st) => cb(st.accounts.find((a) => a.active)?.accountId ?? null));
}

export async function signOut() {
  const s = await selector();
  const w = await s.wallet();
  await w.signOut();
}

/** Calls a pot contract method from the user's wallet. Returns the decoded return value when the wallet gives the outcome back. */
export async function walletCall<T = unknown>(method: string, args: object, depositYocto = "0"): Promise<{ value?: T; hash?: string }> {
  const s = await selector();
  const w = await s.wallet();
  const outcome = await w.signAndSendTransaction({
    receiverId: NEAR_CONTRACT,
    actions: [actionCreators.functionCall(method, args, 100_000_000_000_000n, BigInt(depositYocto))],
  });
  if (!outcome) return {};
  return { value: returnValue<T>(outcome as never), hash: (outcome as { transaction?: { hash?: string } }).transaction?.hash };
}
