# Public Price Action Semantic Review

Public self-audit results and optional semantic feedback for an explicit
multi-timeframe price-action interpreter.

Website: <https://caotengde.github.io/price-action-review/>

## How collection works

1. The system independently recomputes market state with three parameter lenses,
   applies stricter structure thresholds, and verifies causal prefix replay.
2. Only auto-accepted claims are admitted to training; unstable claims are excluded.
3. Optional human feedback remains in browser `localStorage` until submitted.
4. The website opens a pre-filled GitHub Issue containing a compressed JSON payload.
5. A GitHub Action validates the case fingerprint, item IDs, verdicts, corrections,
   coordinates, and payload size.
6. Accepted submissions are stored under `submissions/` and aggregated into
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
