# Public Price Action Semantic Review

Public, owner-centered semantic labels for an explicit multi-timeframe price-action
interpreter.

Website: <https://caotengde.github.io/price-action-review/>

## How collection works

1. Reviewers inspect a fingerprinted chart and atomic interpretation claims.
2. Labels remain in browser `localStorage` until the reviewer chooses to submit.
3. The website opens a pre-filled GitHub Issue containing a compressed JSON payload.
4. A GitHub Action validates the case fingerprint, item IDs, verdicts, corrections,
   coordinates, and payload size.
5. Accepted submissions are stored under `submissions/` and aggregated into
   `data/reviews.jsonl`.

The browser receives no repository token. A GitHub account is required only when
the reviewer publishes the Issue.

## Dataset contract

Verdicts are `CORRECT`, `INCORRECT`, or `UNCERTAIN`. Every incorrect verdict must
include the reviewer's corrected interpretation. Reviewers can also add a missing
structure, level, channel, context, or market-cycle relationship and optionally
bind it to normalized chart coordinates.

Every record contains:

- immutable case ID and SHA-256-derived case fingerprint;
- GitHub issue number and author login;
- claimed experience level;
- atomic annotations and corrections;
- missing interpretations;
- client, GitHub, and collection timestamps.

Raw public submissions are research observations, not ground truth by default.
Rule changes require repeated counterexamples and held-out causal regression.

## Safety

This repository describes market interpretation only. It does not provide
investment advice, calculate position sizes, or connect to order execution.

## License

Code is available under the MIT License. Public review submissions are provided
under CC0-1.0 so they can be used to improve and evaluate explicit market-
understanding systems.
