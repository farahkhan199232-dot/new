import { geminiConfigured, GEMINI_MODEL } from "@/lib/gemini";
import { DEMO_MEMBERS, DEMO_PAYEE, MPC_CONTRACT, NEAR_AGENT, NEAR_CONTRACT, NEAR_DEMO_POT, NEAR_NETWORK, NEAR_RPC } from "@/lib/near/config";
import { agentConfigured, demoConfigured } from "@/lib/near/server";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    network: NEAR_NETWORK,
    contract: NEAR_CONTRACT,
    agent: NEAR_AGENT,
    rpc: NEAR_RPC,
    mpc: MPC_CONTRACT,
    demoPot: NEAR_DEMO_POT,
    demoMembers: DEMO_MEMBERS,
    demoPayee: DEMO_PAYEE,
    ai: geminiConfigured(),
    model: GEMINI_MODEL,
    agentReady: agentConfigured(),
    demoReady: demoConfigured(),
  });
}
