# Public repository privacy rules

This repository is public. Apply these rules to code, tests, documentation, fixtures, commits, and pull requests.

- Never include personal wallet addresses, transaction hashes tied to a user, balances, position sizes, account labels, or account-specific hardware-wallet derivation paths.
- Use placeholders such as `0xYourAddress`, `$ETH_FROM`, and `$HD_PATH`. Obtain real values at runtime through environment variables or CLI arguments.
- Do not commit private keys, seed phrases, credentials, API tokens, private RPC URLs, environment files, terminal logs, or local machine paths.
- Public protocol contract addresses, token addresses, oracle addresses, and market IDs required for functionality are allowed. Do not confuse these with personal wallet addresses.
- Use synthetic amounts for examples and tests. Do not copy live personal portfolio data into fixtures.
- Use anonymous commit author and committer metadata: `Repository Contributors <contributors@example.invalid>`. Do not add personal names or email addresses in commit trailers.
- Before committing or pushing, inspect all tracked files, staged changes, commit messages, and author/committer metadata for identifying or sensitive information.
- If sensitive information has already been pushed, tell the user. Removing it from the latest files is not enough: coordinate a history rewrite and use explicit force-with-lease protections. Hosting caches, forks, and existing clones may retain old copies.
- Never submit financial transactions as part of tests. Rehearse with a local fork and require the user's explicit review and hardware-wallet confirmation for real transactions.
