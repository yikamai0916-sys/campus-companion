# Theme contrast and desktop layout verification — 2026-10-28

Base: classmate branch `claude/locale-fix`, commit `d3362bb`.

Changes:
- Center the main column inside the area beside the sidebar on wide screens.
- Use a solid fill for light-theme primary actions.
- Give authentication tabs and locale controls explicit readable foreground/background pairs.
- Use dark surfaces, readable text and green selection rings for dark-theme reminder choices, priority selection and related selected controls.
- Refresh stylesheet version URLs while preserving the classmate's latest mail-reader fixes and completion animation.

Verification:
- Browser check: `CAMPUS_PLAYWRIGHT=<installed playwright path> node test/theme.browser.mjs`.
- Real local UI controls were used without creating an account or reading private data.
- Light/dark login and registration tabs, language choices, reminder presets, weekday and notification choices met 4.5:1 text contrast for enabled controls.
- Priority and checkbox selection remained interactive.
- Main column centered at 1440, 1920 and 2560 pixels; no horizontal overflow at those sizes or 390 pixels.
- Dark registration and task-dialog screenshots were inspected.
- Existing Node suite: 74 passed, 3 failed out of 77. The same three failures reproduced on the unmodified `d3362bb` baseline: authenticated CRUD returns 400 instead of 200; localization test fails during module evaluation; progress-card colour assertion still expects the previous lavender palette. These failures are not resolved by this CSS change.

Delivery: GitHub review branch only. Publishing the branch does not deploy it to the classmate's Cloudflare site. Outlook credentials and local databases are excluded.
