import {
  createPublicClient,
  http,
  getAddress,
  parseAbi,
  decodeEventLog,
  type Hex
} from "viem";
import type { PaymentVerificationResult, VerifyPaymentInput } from "./types.js";

const ERC20_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function decimals() view returns (uint8)"
]);

function decimalToBaseUnits(value: string, decimals: number): bigint {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Invalid price");
  const neg = trimmed.startsWith("-");
  if (neg) throw new Error("Invalid price");
  const [wholeRaw, fracRaw = ""] = trimmed.split(".");
  const wholePart = wholeRaw && wholeRaw.length > 0 ? wholeRaw : "0";
  if (!/^\d+$/.test(wholePart)) throw new Error("Invalid price");
  if (fracRaw && !/^\d+$/.test(fracRaw)) throw new Error("Invalid price");
  const whole = BigInt(wholePart);
  const fracPadded = (fracRaw + "0".repeat(decimals)).slice(0, decimals);
  const frac = fracPadded ? BigInt(fracPadded) : 0n;
  return whole * 10n ** BigInt(decimals) + frac;
}

// The reference is bound on-chain by appending `x402:<reference>` (as utf-8
// hex) to the ERC-20 `transfer` calldata. ERC-20 implementations ignore the
// trailing bytes, but they are recorded in the transaction input.
function referenceInCalldata(input: Hex, reference: string): boolean {
  const tag = `x402:${reference}`;
  const tagHex = Buffer.from(tag, "utf8").toString("hex").toLowerCase();
  return input.toLowerCase().includes(tagHex);
}

export async function verifyPayment(params: {
  rpcUrl: string;
  receiverAddress: string;
  tokenAddress: string;
  requireMemoReference?: boolean;
  input: VerifyPaymentInput;
}): Promise<PaymentVerificationResult> {
  const receiver = getAddress(params.receiverAddress);
  const token = getAddress(params.tokenAddress);

  const txHash = params.input.txSig as Hex;
  const quote = params.input.quote;

  const client = createPublicClient({ transport: http(params.rpcUrl) });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    return { ok: false, reason: "Transaction not found", txSig: txHash };
  }
  if (!receipt) return { ok: false, reason: "Transaction not found", txSig: txHash };
  if (receipt.status !== "success") return { ok: false, reason: "Transaction failed", txSig: txHash };

  const nowMs = Date.now();
  const expMs = Date.parse(quote.expiresAt);
  if (!Number.isFinite(expMs) || nowMs > expMs) return { ok: false, reason: "Quote expired", txSig: txHash };

  const decimals = await client.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "decimals"
  });
  const requiredAmount = decimalToBaseUnits(quote.price, Number(decimals));

  let paidAmount = 0n;
  for (const logEntry of receipt.logs) {
    if (getAddress(logEntry.address) !== token) continue;
    let decoded;
    try {
      decoded = decodeEventLog({ abi: ERC20_ABI, data: logEntry.data, topics: logEntry.topics });
    } catch {
      continue;
    }
    if (decoded.eventName !== "Transfer") continue;
    const { to, value } = decoded.args as { to: `0x${string}`; value: bigint };
    if (getAddress(to) !== receiver) continue;
    paidAmount += value;
  }

  if (paidAmount < requiredAmount) {
    return { ok: false, reason: "Insufficient payment amount", txSig: txHash };
  }

  const requireMemo = params.requireMemoReference ?? true;
  if (requireMemo) {
    const tx = await client.getTransaction({ hash: txHash });
    if (!tx || !referenceInCalldata(tx.input, quote.reference)) {
      return { ok: false, reason: "Missing reference binding", txSig: txHash };
    }
  }

  return { ok: true, txSig: txHash };
}
