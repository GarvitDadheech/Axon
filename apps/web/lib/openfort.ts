/**
 * Openfort backend (agent) wallets — the server-side "spend engine" that
 * pays for x402 tool calls on a user's behalf, without a wallet popup.
 *
 * Flow:
 * 1. Provision one EVM backend wallet per Axon user (openfort_wallet_id + address)
 * 2. User funds that address (Particle Auth transfer on Sepolia, or Particle UA → agent)
 * 3. User enables spending policy (max_per_call / max_per_day)
 * 4. MCP calls openfortPayer → USDC transfer with x402:<reference> in calldata
 *
 * Requires OPENFORT_SECRET_KEY + OPENFORT_WALLET_SECRET (base64 DER, not PEM).
 * OPENFORT_POLICY_ID optional for gas sponsorship.
 * No fake tx hashes — payments fail closed when Openfort is not configured.
 */

import { Openfort } from "@openfort/openfort-node";
import {
  concatHex,
  createPublicClient,
  encodeFunctionData,
  http,
  parseAbi,
  toHex,
  type Hex,
} from "viem";
import type { Payer, Quote } from "@x402/client";
import { env, openfortConfigured } from "@/lib/env";
import { ARBITRUM_CHAIN_ID, arbitrumRpcUrl, USDC_DECIMALS } from "@/lib/arbitrum";
import { setOpenfortWallet, type DBUser } from "@/lib/queries/users";
import { getSpentToday } from "@/lib/queries/api-calls";

const ERC20_TRANSFER_ABI = parseAbi([
  "function transfer(address to, uint256 value) returns (bool)",
]);

let _openfort: Openfort | null = null;

function openfort(): Openfort {
  if (_openfort) return _openfort;
  const e = env();
  _openfort = new Openfort(e.OPENFORT_SECRET_KEY, {
    ...(e.OPENFORT_WALLET_SECRET ? { walletSecret: e.OPENFORT_WALLET_SECRET } : {}),
  });
  return _openfort;
}

export interface AgentWallet {
  id: string;
  address: `0x${string}`;
}

/** Get the user's Openfort agent wallet, provisioning one on first use. */
export async function getOrCreateAgentWallet(user: DBUser): Promise<AgentWallet> {
  if (!openfortConfigured()) {
    throw new Error(
      "OPENFORT_SECRET_KEY is not configured. Agent wallets require a live Openfort project — see https://dashboard.openfort.io"
    );
  }

  if (user.openfort_wallet_id && !user.openfort_wallet_id.startsWith("stub_")) {
    const account = await openfort().accounts.evm.backend.get({ id: user.openfort_wallet_id });
    if (user.openfort_wallet_address !== account.address) {
      await setOpenfortWallet(user.id, account.id, account.address);
    }
    return { id: account.id, address: account.address as `0x${string}` };
  }

  const account = await openfort().accounts.evm.backend.create({});
  await setOpenfortWallet(user.id, account.id, account.address);
  return { id: account.id, address: account.address as `0x${string}` };
}

export interface AgentPaymentResult {
  txHash: string;
}

/** Pay `amountUsdc` USDC to `to` from the user's Openfort agent wallet on Arbitrum. */
export async function payWithAgentWallet(params: {
  user: DBUser;
  to: `0x${string}`;
  amountUsdc: string;
  reference: string;
  tokenAddress: `0x${string}`;
}): Promise<AgentPaymentResult> {
  const wallet = await getOrCreateAgentWallet(params.user);
  const account = await openfort().accounts.evm.backend.get({ id: wallet.id });

  const amountBaseUnits = BigInt(Math.round(parseFloat(params.amountUsdc) * 10 ** USDC_DECIMALS));
  const transferData = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [params.to, amountBaseUnits],
  });
  // Bind payment to the x402 quote — packages/sdk verifyPayment requires this.
  const referenceHex = toHex(`x402:${params.reference}`);
  const data = concatHex([transferData, referenceHex]);

  // OPENFORT_POLICY_ID must be a gas/fee-sponsorship policy id if set.
  // Project-scoped policyV2 signing rules (signEvmHash / sendEvmTransaction)
  // are evaluated automatically — do not pass those ids here (Openfort returns
  // "Invalid pol: 'ply_…'").
  const gasPolicy = env().OPENFORT_POLICY_ID || undefined;
  let result;
  try {
    result = await openfort().accounts.evm.backend.sendTransaction({
      account,
      chainId: ARBITRUM_CHAIN_ID,
      interactions: [{ to: params.tokenAddress, data }],
      ...(gasPolicy && !gasPolicy.startsWith("ply_")
        ? { policy: gasPolicy }
        : {}),
      rpcUrl: arbitrumRpcUrl(),
    });
  } catch (err) {
    throw mapOpenfortPaymentError(err);
  }

  const txHash = result.response?.transactionHash as Hex | undefined;
  if (!txHash) {
    throw new Error("Openfort sendTransaction did not return a transaction hash");
  }

  const publicClient = createPublicClient({ transport: http(arbitrumRpcUrl()) });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash };
}

/** Openfort's SDK replaces 403 bodies with a generic Forbidden string — make it actionable. */
function mapOpenfortPaymentError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  const statusCode =
    err && typeof err === "object" && "statusCode" in err
      ? Number((err as { statusCode?: number }).statusCode)
      : undefined;

  if (
    statusCode === 403 ||
    /forbidden/i.test(message) ||
    /don't have permission/i.test(message)
  ) {
    return new Error(
      "Openfort rejected wallet signing (HTTP 403). OPENFORT_WALLET_SECRET does not match this project's backend wallet key — regenerate it in the Openfort Dashboard (Backend wallets), update root .env + apps/web/.env.local, and restart apps/web. API key and wallet secret must be from the same project (both sk_test_ / test wallet secret)."
    );
  }

  return err instanceof Error ? err : new Error(message);
}

/** x402 Payer backed by the user's Openfort agent wallet + spending policy. */
export function openfortPayer(user: DBUser): Payer {
  return async (quote: Quote) => {
    if (!user.server_signing_enabled) {
      throw new Error(
        "Agent spending is disabled. Enable a spending policy on the Axon dashboard first."
      );
    }

    const price = parseFloat(quote.price);
    if (user.max_per_call != null && price > parseFloat(user.max_per_call)) {
      throw new Error(
        `Payment of ${quote.price} USDC exceeds your per-call spending policy of ${user.max_per_call} USDC.`
      );
    }

    if (user.max_per_day != null) {
      const spentToday = await getSpentToday(user.id);
      if (spentToday + price > parseFloat(user.max_per_day)) {
        throw new Error(
          `Payment of ${quote.price} USDC would exceed your daily spending policy of ${user.max_per_day} USDC (already spent ${spentToday.toFixed(4)} today).`
        );
      }
    }

    const result = await payWithAgentWallet({
      user,
      to: quote.receiver as `0x${string}`,
      amountUsdc: quote.price,
      reference: quote.reference,
      tokenAddress: quote.tokenAddress as `0x${string}`,
    });
    return result.txHash;
  };
}
