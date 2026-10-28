import { base, baseSepolia } from "viem/chains";
export type Address = `0x${string}`;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453);
export const chain = CHAIN_ID === 8453 ? base : baseSepolia;

export const USDC_ADDRESS: Address =
  CHAIN_ID === 8453
    ? "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    : "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export const SETTLEMENT_ADDRESS = (process.env.NEXT_PUBLIC_SETTLEMENT_ADDRESS ?? "") as Address;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const settlementAbi = [
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "groupId", type: "bytes32" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "memo", type: "bytes32" },
    ],
    outputs: [{ name: "fee", type: "uint256" }],
  },
  {
    type: "function",
    name: "settleBatch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "groupId", type: "bytes32" },
      {
        name: "payments",
        type: "tuple[]",
        components: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      },
      { name: "memo", type: "bytes32" },
    ],
    outputs: [{ name: "totalFee", type: "uint256" }],
  },
  {
    type: "function",
    name: "feeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint16" }],
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "groupId", type: "bytes32", indexed: true },
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "memo", type: "bytes32", indexed: false },
    ],
  },
] as const;
