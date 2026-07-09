/**
 * Openfort backend (agent) wallets — the server-side "spend engine" that
 * pays for x402 tool calls on a user's behalf, without a wallet popup.
 *
 * One Openfort EVM backend wallet is provisioned per Axon user (id persisted
 * as `users.openfort_wallet_id`) and used to sign+submit gasless, EIP-7702
 * delegated USDC transfers on Arbitrum via `accounts.evm.backend.sendTransaction`.
 *
 * Stub mode: when OPENFORT_SECRET_KEY isn't configured, wallet creation and
 * payments are simulated (deterministic fake id/address, fake tx hash) so
 * the rest of the app — timeline, spend caps, MCP flow — works end to end
 * without a live Openfort project.
 */

import { Openfort } from "@openfort/openfort-node";
import { encodeFunctionData, parseAbi } from "viem";
import type { Payer, Quote } from "@x402/client";
import { env, openfortConfigured } from "@/lib/env";
import { ARBITRUM_CHAIN_ID, usdcAddress, USDC_DECIMALS } from "@/lib/arbitrum";
import { setOpenfortWallet, type DBUser } from "@/lib/queries/users";

const ERC20_TRANSFER_ABI = parseAbi([
  "function transfer(address to, uint256 value) returns (bool)",
]);

let _openfort: Openfort | null = null;

function openfort(): Openfort {
  if (_openfort) return _openfort;
  _openfort = new Openfort(env().OPENFORT_SECRET_KEY);
  return _openfort;
}

export interface AgentWallet {
  /** Openfort account id (acc_...), or a `stub_` id in demo mode. */
  id: string;
  address: string;
  stub: boolean;
}

/** Get the user's Openfort agent wallet, provisioning one on first use. */
export async function getOrCreateAgentWallet(user: DBUser): Promise<AgentWallet> {
  if (!openfortConfigured()) {
    const id = user.openfort_wallet_id ?? `stub_acc_${user.id}`;
    if (!user.openfort_wallet_id) await setOpenfortWallet(user.id, id);
    return { id, address: user.wallet_address, stub: true };
  }

  if (user.openfort_wallet_id && !user.openfort_wallet_id.startsWith("stub_")) {
    const account = await openfort().accounts.evm.backend.get({ id: user.openfort_wallet_id });
    return { id: account.id, address: account.address, stub: false };
  }

  const account = await openfort().accounts.evm.backend.create({});
  await setOpenfortWallet(user.id, account.id);
  return { id: account.id, address: account.address, stub: false };
}

export interface AgentPaymentResult {
  txHash: string;
  stub: boolean;
}

/** Pay `amountUsdc` USDC to `to` from the user's Openfort agent wallet on Arbitrum. */
export async function payWithAgentWallet(params: {
  user: DBUser;
  to: `0x${string}`;
  amountUsdc: string;
  reference: string;
}): Promise<AgentPaymentResult> {
  const wallet = await getOrCreateAgentWallet(params.user);

  if (wallet.stub) {
    const seed = Buffer.from(`${params.reference}:${params.amountUsdc}`).toString("hex");
    return { txHash: `0x${seed.padEnd(64, "0").slice(0, 64)}`, stub: true };
  }

  const account = await openfort().accounts.evm.backend.get({ id: wallet.id });
  const amountBaseUnits = BigInt(Math.round(parseFloat(params.amountUsdc) * 10 ** USDC_DECIMALS));
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [params.to, amountBaseUnits],
  });

  const result = await openfort().accounts.evm.backend.sendTransaction({
    account,
    chainId: ARBITRUM_CHAIN_ID,
    interactions: [{ to: usdcAddress(), data }],
  });

  const txHash = result.response?.transactionHash;
  if (!txHash) throw new Error("Openfort sendTransaction did not return a transaction hash");
  return { txHash, stub: false };
}

/** x402 Payer backed by the user's Openfort agent wallet, enforcing their
 *  per-call spending policy (`users.max_per_call`) before signing. */
export function openfortPayer(user: DBUser): Payer {
  return async (quote: Quote) => {
    if (user.max_per_call != null && parseFloat(quote.price) > parseFloat(user.max_per_call)) {
      throw new Error(
        `Payment of ${quote.price} USDC exceeds your per-call spending policy of ${user.max_per_call} USDC.`
      );
    }
    const result = await payWithAgentWallet({
      user,
      to: quote.receiver as `0x${string}`,
      amountUsdc: quote.price,
      reference: quote.reference,
    });
    return result.txHash;
  };
}
