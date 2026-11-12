import type { Address, Hex } from "viem";

export const CHAIN_ID = 1n;

export const MORPHO_BLUE: Address =
  "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb";
export const MIDNIGHT: Address = "0x471686c42792F93528B000beF54bC10E3aa2045f";
// Tenor's BorrowBlueToMidnightCallback on Ethereum (docs.tenor.finance/smart-contract-docs/addresses).
export const CALLBACK: Address = "0xbB91265Fd479094d7f1B1B20AF79A07442df9850";
// Tenor's BorrowMidnightRenewalCallback on Ethereum: rolls a Midnight borrow into a later-maturity Midnight market.
// The same docs page lists Base addresses too, with different roles; this one is checked on-chain at startup.
export const RENEWAL_CALLBACK: Address =
  "0xAbae3A858f53C7010D07ee930b3a0621adcFBBA8";
export const USDC: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

export const MORPHO_API = "https://api.morpho.org";
export const DEFAULT_RPC = "https://ethereum-rpc.publicnode.com";

export type LoanConfig = {
  symbol: string;
  decimals: number;
  blueMarketId: Hex;
};

// Explicitly reviewed exception; never broaden oracle matching for other markets.
export const WSTETH_DESTINATION: Hex =
  "0x20db6336fa557dab4d29e3d6c3eaca63d99911b8d9106c4642c165b054ce4f03";
export const WSTETH_BLUE_ORACLE: Address =
  "0x48F7E36EB6B826B2dF4B2E630B62Cd25e89E40e2";
export const WSTETH_MIDNIGHT_ORACLE: Address =
  "0xe087ad7fe989cf63f8383579d160a20ee7e69f9f";

export const LOANS: Record<string, LoanConfig> = {
  wbtc: {
    symbol: "WBTC",
    decimals: 8,
    blueMarketId:
      "0x3a85e619751152991742810df6ec69ce473daef99e28a64ab2340d7b7ccfee49",
  },
  wsteth: {
    symbol: "wstETH",
    decimals: 18,
    blueMarketId:
      "0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc",
  },
  cbbtc: {
    symbol: "cbBTC",
    decimals: 8,
    blueMarketId:
      "0x64d65c9a2d91c36d56fbc42d69e979335320169b3df63bf92789e2c8883fcc64",
  },
};
