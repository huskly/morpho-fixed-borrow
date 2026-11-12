# wstETH destination oracle review (2026-11-12)

Destination market: `0x20db6336fa557dab4d29e3d6c3eaca63d99911b8d9106c4642c165b054ce4f03`.

- [Verified oracle source](https://eth.blockscout.com/address/0xe087ad7fe989cf63f8383579d160a20ee7e69f9f?tab=contract): MorphoChainlinkOracleV2.
- Base feed 1: `0x4F67e4d9BD67eFa28236013288737D39AeF48e79`.
  [Verified source](https://eth.blockscout.com/address/0x4F67e4d9BD67eFa28236013288737D39AeF48e79?tab=contract): Compound WstETHPriceFeed.
  Uses stETH/ETH Chainlink feed `0x86392dC19c0b719886221c78AB11eb8Cf5c52812`
  and the actual wstETH `tokensPerStEth()` conversion rate.
- Base feed 2: `0xc0053f3FBcCD593758258334Dfce24C2A9A673aD`, live description ETH / USD.
- No base/quote vaults and no quote feeds. USDC is assumed $1; USDC depeg is not reflected in collateral pricing.
- Oracle ChainlinkDataFeedLib rejects negative answers but does not enforce staleness or reject zero answers.
- Observed source price: 2495875989777504078394850863; destination price:
  2511603755760000000000000000 (0.630% higher). Prices change over time.
- Market structure hashes to the supplied destination ID; same deployment, chain, USDC, wstETH and 86% LLTV.

This is source/config inspection plus live reads, not a security audit or a guarantee of feed correctness.
