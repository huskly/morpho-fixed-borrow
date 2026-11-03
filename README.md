# morpho-fixed-borrow

Manages fixed-rate Morpho Midnight USDC loans (WBTC/USDC and cbBTC/USDC on Ethereum) over their whole life, signing
with a Trezor through Foundry's `cast`:

1. **Migrate** a Morpho Blue variable-rate loan into a Midnight fixed-rate market (`migrate`, then `cleanup`).
2. **Roll** the Midnight loan into a later maturity before it matures (`roll`), as many times as needed.
3. Inspect positions, quotes and authorizations at any time (`status`, `quote`), and remove the authorizations when
   done (`revoke`).

## How it works

Both moves are a single `Midnight.take()` on a lender's bid (a fixed-rate borrow), with an audited, immutable Tenor
callback as the taker callback. Within one transaction the callback receives the borrowed USDC, repays the old loan,
and moves the collateral to the new Midnight market. Midnight checks the position's health at the end, and the
whole transaction reverts if anything fails. No Tenor frontend is involved, and the callback fee is set to 0.

| Step | Tenor callback (Ethereum) | Authorizations it needs |
|---|---|---|
| `migrate`: Blue -> Midnight | `BorrowBlueToMidnightCallback` `0xbB91265Fd479094d7f1B1B20AF79A07442df9850` | Blue and Midnight |
| `roll`: Midnight -> later Midnight | `BorrowMidnightRenewalCallback` `0xAbae3A858f53C7010D07ee930b3a0621adcFBBA8` | Midnight |

At startup the CLI checks on-chain that both callbacks are wired to the Morpho Blue and Midnight addresses below.
Tenor's address page also lists Base deployments, where the same addresses have **different** roles (for example
`0x7d4A…5F18` is `BorrowMidnightToBlueCallback` on Ethereum). Do not authorize any other callback.

Only Midnight markets that mirror the Blue market are used: same loan token, and a collateral slot with the same
collateral token, LLTV **and oracle**. Markets with other oracles are priced very differently.

## Requirements

- Node >= 22.18 (runs the TypeScript directly)
- Foundry (`cast`, `anvil`), tested with 1.9.0. Midnight uses the Osaka `CLZ` opcode, so anvil must
  default to Osaka or later. Older anvil (e.g. 1.5.1, which defaults to Prague) fails the `take`
  simulation with "An internal error was received" (`EVM error NotActivated` in anvil's log).
- Trezor with the Ethereum app, connected over USB (Linux: Trezor udev rules installed)

```sh
npm install
export ETH_FROM=0xYourAddress
export ETH_RPC_URL=https://...           # optional; defaults to a public RPC
```

Use `--hd-path "m/44'/60'/0'/0/N"` if the account is not at the default index. Find the index with
`cast wallet address --trezor --mnemonic-derivation-path "m/44'/60'/0'/0/N"` for N = 0, 1, 2, ...

## Commands

```sh
node src/cli.ts status                                   # positions, days to maturity, authorizations
node src/cli.ts quote   --loan wbtc                      # fixed rates for every mirror maturity
node src/cli.ts migrate --loan wbtc --maturity 2026-12-25 --max-rate 4.5     # optionally --amount 50000
node src/cli.ts cleanup --loan wbtc --maturity 2026-12-25
node src/cli.ts roll    --loan wbtc --from-maturity 2026-12-25 --maturity 2027-03-26 --max-rate 6
node src/cli.ts revoke
```

Every command that sends transactions prints a plan and asks for confirmation. It checks that the Trezor address
matches `ETH_FROM`, simulates each transaction from your address, and asks again before each one is signed. When
signing, check on the Trezor that `to` matches the printed address: Morpho Blue `0xBBBB…FFCb`, Midnight `0x4716…045f`,
or the token being approved (USDC `0xA0b8…eB48`, WBTC `0x2260…C599`, cbBTC `0xcbB7…33Bf`). The Trezor may warn that a
token or contract is unknown, because `cast` does not send it token metadata. Accept only if the address matches.

### migrate

Moves the Blue loan into the chosen maturity. Sends up to three transactions: authorize the migration callback on
Blue, authorize it on Midnight, then `take()`. It re-quotes right before `take()` and aborts if the rate is above
`--max-rate`. By default it migrates the Blue debt minus a `--buffer` of 1 USDC: the callback reverts if it would
repay more than the debt, and Blue debt grows every block. `--amount` migrates only part of the debt.

### cleanup

Finishes a migration. Repays the leftover Blue debt from your wallet's USDC (a few dollars; keep ~5 USDC in the
wallet), withdraws the leftover collateral, and supplies it to the same Midnight market. Needs an approval for each
token. Collateral already in the wallet (e.g. from an interrupted cleanup) is supplied too; the confirmation prompt
shows the amount. Safe to re-run.

After a partial `migrate --amount`, run `migrate` again without `--amount` before `cleanup`: `cleanup` would
otherwise try to repay the rest of the Blue debt from the wallet.

### roll

Moves the Midnight loan maturing on `--from-maturity` into the later `--maturity`. Sends up to two transactions:
authorize the renewal callback on Midnight, then `take()`.

Midnight debt does not grow before maturity, so the new loan is sized to repay the old debt **exactly**. The callback
then moves all collateral in the same transaction, and no cleanup is needed. The plan shows the new rate, the amount
owed at the new maturity, the resulting health factor, and the extra interest of rolling early (see below).
`--amount` rolls only part of the debt and moves collateral in proportion; a later `roll` without `--amount` moves the
rest.

If Midnight's settlement fee for USDC becomes non-zero (it is 0 today), the proceeds can change by one unit between
simulation and mining. The take then reverts with `ExcessRepayment` (only gas is lost); re-run `roll`.

### revoke

Removes every authorization the tool granted: the migration callback on Blue and Midnight, and the renewal callback
on Midnight. Run it after migrating or rolling all loans (authorizations are per account, not per market).

## Fixed-term reminders

- Repay or roll **before** the maturity timestamp. After it, anyone can liquidate the position regardless of health,
  and the liquidation bonus reaches its maximum within 60 minutes. `status` shows the days left.
- The amount owed at maturity is the Midnight debt shown by `status` (it already includes the interest).
- `repay` (and therefore `roll`) costs face value, 1 USDC per unit, at any time. Rolling `d` days early costs roughly
  `debt × new rate × d / 365` of extra interest; `roll` prints the estimate. Rolling late is cheaper, but leave margin:
  liquidity can disappear (on 2026-11-03 a single lender provided all offers), and without fixed-rate offers the
  debt must be repaid in USDC. Check `quote` regularly as maturity approaches.

## Rehearse on a mainnet fork first

```sh
npm test            # offline unit tests (tick math, market ids, roll sizing)
npm run test:fork   # migrate -> cleanup (if Blue debt is left) -> roll -> revoke on an anvil fork
```

The fork test forks the current chain head (quotes are live signed offers) and impersonates `FORK_ACCOUNT` (default:
`ETH_FROM`). Other env overrides: `FORK_URL`, `MATURITY` (roll source, default 2026-12-25), `ROLL_MATURITY` (default
2027-03-26). Loans without Blue debt skip the migrate step; loans without debt at `MATURITY` skip the roll.

Or step through it by hand with exactly the same commands:

```sh
anvil --fork-url $ETH_RPC_URL --auto-impersonate
node src/cli.ts roll --loan wbtc --from-maturity 2026-12-25 --maturity 2027-03-26 --max-rate 6 \
  --rpc-url http://127.0.0.1:8545 --signer unlocked
```

## Future ideas

- **`unroll` (Midnight -> Blue).** A fallback for when no acceptable fixed-rate offers exist near maturity: move the
  Midnight loan back to the Blue variable-rate market instead of repaying it in USDC. Tenor's
  `BorrowMidnightToBlueCallback` on Ethereum (`0x7d4A92F88c22c6dD31F0fB67F27cAFC8e90f5F18`) is built for this. Not
  implemented yet; it would need its own source review, sizing rules and fork test before use.
