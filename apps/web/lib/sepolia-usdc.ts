import {
  createPublicClient,
  formatUnits,
  http,
  parseAbi,
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { arbitrumRpcUrl, usdcAddress, USDC_DECIMALS } from "@/lib/arbitrum";

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
]);

/** Openfort agent spend balance on Arbitrum Sepolia (MCP settlement chain). */
export async function fetchSepoliaUsdcBalance(
  address: `0x${string}`
): Promise<string> {
  const client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(arbitrumRpcUrl()),
  });
  const raw = await client.readContract({
    address: usdcAddress(),
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
  });
  return formatUnits(raw, USDC_DECIMALS);
}
