export const PAYMENT_TX_HEADER = "x-payment-tx";
export const PAYMENT_REFERENCE_HEADER = "x-payment-reference";

export const DEFAULT_QUOTE_TTL_SECONDS = 5 * 60;

// USDC on Arbitrum Sepolia. Override via the TOKEN_ADDRESS / USDC_ADDRESS env var.
export const USDC_ADDRESS = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
export const USDC_TOKEN_NAME = "USDC";
export const USDC_NETWORK = "arbitrum-sepolia";

// Arbitrum Sepolia chain id (used by the EVM clients when signing/sending).
export const ARBITRUM_CHAIN_ID = 421614;
