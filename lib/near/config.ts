/** NEAR settings shared by server and browser. Testnet only. */
export const NEAR_NETWORK = (process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet") as "testnet" | "mainnet";
export const NEAR_CONTRACT = process.env.NEXT_PUBLIC_NEAR_CONTRACT || "chai-pot-near.testnet";
export const NEAR_AGENT = process.env.NEXT_PUBLIC_NEAR_AGENT || "chai-pot-agent.testnet";
export const NEAR_RPC = process.env.NEXT_PUBLIC_NEAR_RPC || "https://test.rpc.fastnear.com";
export const NEAR_DEMO_POT = Number(process.env.NEXT_PUBLIC_NEAR_DEMO_POT ?? 1);
export const NEAR_EXPLORER = process.env.NEXT_PUBLIC_NEAR_EXPLORER || "https://testnet.nearblocks.io";
/** NEAR Chain Signatures MPC signer on testnet. */
export const MPC_CONTRACT = process.env.NEXT_PUBLIC_MPC_CONTRACT || "v1.signer-prod.testnet";
/** Demo members of the seeded pot: sub-accounts of the contract account (testnet keys held by the demo server). */
export const DEMO_MEMBERS = ["asha", "ravi", "meera"].map((n) => `${n}.${NEAR_CONTRACT}`);
export const DEMO_PAYEE = `cafe.${NEAR_CONTRACT}`;
export const txUrl = (hash: string) => `${NEAR_EXPLORER}/txns/${hash}`;
export const accountUrl = (id: string) => `${NEAR_EXPLORER}/address/${id}`;
