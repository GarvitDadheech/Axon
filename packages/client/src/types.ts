export type Quote = {
  endpoint: string;
  method: string;
  price: string;
  token: string;
  tokenAddress: string;
  receiver: string;
  reference: string;
  expiresAt: string;
  name?: string;
  description?: string;
  category?: string;
  fiatEquivalent?: string;
  tokenName?: string;
};

export type Payer = (quote: Quote) => Promise<string>;

export type UsdcClientConfig = {
  payer: Payer;
};

export type ServerWalletPayerConfig = {
  privateKey: string;
  rpcUrl: string;
  chainId?: number;
};
