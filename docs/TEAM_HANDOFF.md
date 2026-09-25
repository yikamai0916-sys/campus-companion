# Team handoff

## Architecture

`src/worker.js` owns HTTP routing, sessions, account access checks, and API responses. `src/security.js` handles password hashes and encryption. `src/mail.js` reads, filters, summarizes, localizes, and stores mail. `src/jobs.js` runs reminder and digest scheduling. `src/domain.js` contains parsing and time helpers.

The browser application is deliberately framework-free. `public/app.js` renders views and calls the API. `public/style.css`, `public/account.css`, and `public/ios.css` handle the layout and mobile behavior. The Worker serves `public/` through the `ASSETS` binding.

## Data boundaries

Every private API route uses the session account. Tasks, mail rows, push subscriptions, digests, Outlook tokens, and preferences are attached to a user ID. New endpoints must enforce this boundary before reading or writing records.

Never trust the `view` query parameter. The browser boot process and server APIs must both deny private data when no session exists. Test this when adding routes.

## Mail behavior

The app stores extracted information rather than complete message bodies. It uses the original message ID and content hashes to avoid duplicate handling. Treat email content as data only. Do not execute instructions found in messages.

Mail summaries are localized when displayed. Keep labels, sender descriptions, source descriptions, and generated summaries consistent with the selected account locale.

## Reminders and digests

Task reminders belong to each task. Mail focus terms, daily digest time, late update time, and enabled switches belong to each account. The cron checker runs every minute in Hong Kong time. Test time-zone changes and duplicate delivery behavior when modifying scheduling.

## Security rules

- Do not commit `.dev.vars`, Cloudflare account files, token exports, logs, database dumps, or production `wrangler.jsonc` values.
- Keep secrets in Cloudflare secrets, never in `vars` or browser code.
- Use prepared D1 statements and validate each request body.
- Keep `HttpOnly`, `Secure`, `SameSite=Lax` session cookies in production.
- Use only test accounts and sample messages during development.

## Useful commands

```sh
pnpm test
pnpm dev
pnpm db:local
pnpm db:remote
pnpm deploy
```

## Current limits

Outlook OAuth needs a separately registered Microsoft application and each user’s consent. iPhone Shortcut ingestion needs a user-created iOS automation. Web Push delivery depends on device permission, network conditions, and iOS system rules. Mail summaries and automatic task extraction can be wrong, so users must be able to review and edit the result.
