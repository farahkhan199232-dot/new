import { createConfig, http, cookieStorage, createStorage } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";
import { CHAIN_ID } from "./contract";

/** Optional USDC funding on Base: Base Account (passkey smart wallet) or any injected wallet. Reused from SplitChai. */
export const chain = CHAIN_ID === 8453 ? base : baseSepolia;

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [baseAccount({ appName: "Chai Pot" }), injected()],
  transports: { [base.id]: http(), [baseSepolia.id]: http() },
  ssr: true,
  storage: createStorage({ storage: cookieStorage }),
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
