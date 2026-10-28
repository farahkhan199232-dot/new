import { createPublicClient, http, keccak256, toBytes, parseEventLogs } from "viem";
import { chain, settlementAbi, SETTLEMENT_ADDRESS, CHAIN_ID } from "./contract";

/**
 * Server-side verification of USDC contributions made through the pre-existing
 * SplitChaiSettlement contract on Base (reused from SplitChai). A contribution is
 * only recorded after the Settled event is found in the receipt.
 */
export const publicClient = createPublicClient({
  chain,
  transport: http(process.env.RPC_URL || (chain.id === 84532 ? "https://base-sepolia-rpc.publicnode.com" : "https://base-rpc.publicnode.com")),
});

export const onchainPotId = (id: string) => keccak256(toBytes(`chaipot:${id}`));
export const usdcEnabled = () => !!SETTLEMENT_ADDRESS;

/** USDC has 6 decimals; pot minor units have 2. Returns net amount the treasury received, in cents. */
export async function verifyUsdcContribution(txHash: `0x${string}`, potId: string, treasury: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 30_000 });
  if (receipt.status !== "success") throw new Error("Transaction reverted");
  const logs = parseEventLogs({ abi: settlementAbi, logs: receipt.logs, eventName: "Settled" }).filter(
    (l) =>
      l.address.toLowerCase() === SETTLEMENT_ADDRESS.toLowerCase() &&
      l.args.groupId === onchainPotId(potId) &&
      l.args.to.toLowerCase() === treasury.toLowerCase(),
  );
  if (!logs.length) throw new Error("No Chai Pot USDC transfer to this pot found in that transaction");
  const net = logs.reduce((s, l) => s + (l.args.amount - l.args.fee), 0n);
  return { cents: Number(net / 10_000n), from: logs[0].args.from.toLowerCase(), chainId: CHAIN_ID };
}
