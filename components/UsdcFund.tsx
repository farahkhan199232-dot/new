"use client";

import { useEffect, useRef, useState } from "react";
import { encodeFunctionData, keccak256, toBytes } from "viem";
import { useAccount, useCallsStatus, useConnect, useSendCalls } from "wagmi";
import { SETTLEMENT_ADDRESS, USDC_ADDRESS, erc20Abi, settlementAbi } from "@/lib/contract";
import { chain } from "@/lib/wagmi";

/**
 * Optional: contribute USDC on Base through the pre-existing SplitChaiSettlement
 * contract (approve + settle in one EIP-5792 bundle). The server verifies the
 * Settled event before recording anything.
 */
export function UsdcFund({ potId, treasury, amount, onTx }: { potId: string; treasury: string; amount: string; onTx: (hash: string) => Promise<void> }) {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { sendCalls, data, isPending, error } = useSendCalls();
  const { data: status } = useCallsStatus({
    id: data?.id ?? "",
    query: { enabled: !!data?.id, refetchInterval: (q) => (q.state.data?.status === "success" ? false : 1500) },
  });
  const reported = useRef<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const hash = status?.receipts?.at(-1)?.transactionHash;
    if (status?.status === "success" && hash && reported.current !== hash) {
      reported.current = hash;
      setMsg("Verifying on Base…");
      onTx(hash)
        .then(() => setMsg(""))
        .catch((e) => setMsg((e as Error).message));
    }
  }, [status, onTx]);

  if (!SETTLEMENT_ADDRESS) return <p className="muted small">USDC funding not configured on this deployment.</p>;

  let units = 0n;
  try {
    const [w, f = ""] = amount.split(".");
    units = BigInt(w || "0") * 1_000_000n + BigInt((f + "000000").slice(0, 6));
  } catch {
    units = 0n;
  }

  const pay = () => {
    const gid = keccak256(toBytes(`chaipot:${potId}`));
    sendCalls({
      chainId: chain.id,
      calls: [
        { to: USDC_ADDRESS, data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [SETTLEMENT_ADDRESS, units] }) },
        {
          to: SETTLEMENT_ADDRESS,
          data: encodeFunctionData({
            abi: settlementAbi,
            functionName: "settle",
            args: [gid, treasury as `0x${string}`, units, keccak256(toBytes(`chaipot:${potId}:${Date.now()}`))],
          }),
        },
      ],
    });
  };

  return (
    <div className="stack">
      {!isConnected ? (
        <button className="btn secondary" onClick={() => connect({ connector: connectors[0] })}>
          Connect Base wallet
        </button>
      ) : (
        <button className="btn secondary" disabled={isPending || units <= 0n} onClick={pay}>
          {isPending ? "Confirm in wallet…" : `Pay ${amount} USDC on ${chain.name}`}
        </button>
      )}
      {error && <span className="neg small">{error.message.split("\n")[0]}</span>}
      {msg && <span className="muted small">{msg}</span>}
    </div>
  );
}
