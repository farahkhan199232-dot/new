export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com";
export const CLUSTER = "devnet";
export const MINT = process.env.NEXT_PUBLIC_MINT || "2wtbnK229UdTPrDmZGeAjE5AvA2LQtEKgn92ixNW2599";
export const TREASURY = process.env.NEXT_PUBLIC_TREASURY || "GacNYH51CoU8RvqeQBpJr5VdNU5RVio4w5NF55YEgqky";
export const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_TOKEN_SYMBOL || "tUSDC";
export const DEFAULT_FEE_BPS = 30;
export const DEMO_SIGNATURE = process.env.NEXT_PUBLIC_DEMO_SIGNATURE || "";

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
export const explorerAddr = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
