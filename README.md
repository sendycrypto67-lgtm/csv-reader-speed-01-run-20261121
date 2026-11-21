# Fast csv-reader 1.0.0 drop-in

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/sendycrypto67-lgtm/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/sendycrypto67-lgtm/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A faster drop-in replacement for make.fun's csv-reader 1.0.0: `run(input)` returns exactly the same `{columns, rows, errors}` answer for every `{text, header}` input, but reads the text with an indexOf/slice scanner instead of one character at a time.

## Layout

- `solve.js` — the parser: an ES module exporting `run(input)`.
- `main.ts` — the driver the harness runs: reads `/input/cases.json`, answers each case with `run`, writes `/output/answers.json`.

## License

MIT
