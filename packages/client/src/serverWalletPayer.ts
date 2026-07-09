import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  encodeFunctionData,
  getAddress,
  parseAbi,
  concatHex,
  toHex,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { DEFAULT_CHAIN_ID } from "./constants.js";
import type { Payer, ServerWalletPayerConfig } from "./types.js";

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 value) returns (bool)",
  "function decimals() view returns (uint8)"
]);

function normalizePrivateKey(key: string): Hex {
  const trimmed = key.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as Hex;
}

export function serverWalletPayer(config: ServerWalletPayerConfig): Payer {
  return async (quote) => {
    const chainId = config.chainId ?? DEFAULT_CHAIN_ID;
    const chain = defineChain({
      id: chainId,
      name: "Arbitrum Sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [config.rpcUrl] } }
    });

    const account = privateKeyToAccount(normalizePrivateKey(config.privateKey));
    const transport = http(config.rpcUrl);
    const publicClient = createPublicClient({ chain, transport });
    const walletClient = createWalletClient({ account, chain, transport });

    const token = getAddress(quote.tokenAddress);
    const receiver = getAddress(quote.receiver);

    const decimals = await publicClient.readContract({
      address: token,
      abi: ERC20_ABI,
      functionName: "decimals"
    });

    const amountHuman = Number(quote.price);
    if (!Number.isFinite(amountHuman) || amountHuman <= 0)
      throw new Error(`serverWalletPayer: invalid quote price: ${quote.price}`);
    const amountBaseUnits = BigInt(Math.round(amountHuman * 10 ** Number(decimals)));

    // ERC-20 transfer calldata with the x402 reference appended. ERC-20
    // contracts ignore the trailing bytes; the verifier reads them back from
    // the transaction input to bind the payment to this quote.
    const transferData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [receiver, amountBaseUnits]
    });
    const referenceHex = toHex(`x402:${quote.reference}`);
    const data = concatHex([transferData, referenceHex]);

    const hash = await walletClient.sendTransaction({ to: token, data });
    await publicClient.waitForTransactionReceipt({ hash });

    return hash;
  };
}
