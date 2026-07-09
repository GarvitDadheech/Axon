import { type NextRequest } from "next/server";
import { arbitrumRpcUrl, usdcAddress } from "@/lib/arbitrum";

async function rpc(method: string, params: unknown[]): Promise<string> {
  const res = await fetch(arbitrumRpcUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    cache: "no-store",
  });
  const data = await res.json();
  return (data.result as string) ?? "0x0";
}

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address");
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const paddedAddr = address.replace("0x", "").toLowerCase().padStart(64, "0");

    const [ethHex, usdcHex] = await Promise.all([
      rpc("eth_getBalance", [address, "latest"]),
      rpc("eth_call", [
        { to: usdcAddress(), data: `0x70a08231${paddedAddr}` },
        "latest",
      ]),
    ]);

    const eth = (Number(BigInt(ethHex || "0x0")) / 1e18).toFixed(4);
    const usdc = (Number(BigInt(usdcHex || "0x0")) / 1e6).toFixed(2);

    return Response.json({ eth, usdc });
  } catch (err) {
    console.error("[balance]", err);
    return Response.json({ eth: "—", usdc: "—" }, { status: 200 });
  }
}
