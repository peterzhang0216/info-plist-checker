# Contributing

Bug reports and pull requests are welcome, especially when Apple changes a rule.

## Adding or changing a rule

1. Find the Apple page that states the rule (a key page under Information Property List, a technote, an App Store
   Connect upload message quoted on the Apple Developer Forums). A rule without a source will not be merged.
2. In `src/info-plist-checker.mjs`:
   - add the page to `SOURCES` if it is new, and to the list of sources in the comment at the top;
   - push an issue `{ severity, code, key?, value?, expected?, n?, source }` where the check belongs;
   - add the new code to `ISSUE_CODES`.
   Severity: `error` only when App Store Connect or App Review refuses it, or the file is malformed; `warning` for
   things to fix or check; `info` for things worth knowing.
3. Add the message in English and Chinese under `issues` in `src/messages.mjs`. Placeholders `{key}`, `{value}`,
   `{expected}` and `{n}` come from the issue.
4. Add a test in `test/info-plist-checker.test.mjs` that changes one thing in `iosBuilt()` or `macBuilt()` and asserts
   the exact codes returned. If the rule needs a new real-world file, add it under `test/fixtures/` with the app
   renamed and any personal values (team IDs, bundle IDs) replaced.
5. Update `specsCheckedOn` if you re-read Apple's pages, and the "What it checks" list in `README.md`.

Run `npm test` before opening a pull request. Tests use only `node:test`; the parser tests that compare against
`plutil` run on macOS and are skipped elsewhere.

Keep it free of runtime dependencies, and keep shipped code working on Node 18.
