# Setup and deployment

## Requirements

- Node.js 22 or later
- pnpm 9 or later
- A Cloudflare account for a deployed version
- A Microsoft Entra app only if Outlook OAuth is required

## Local development

```sh
pnpm install
cp wrangler.example.jsonc wrangler.jsonc
node setup-secrets.mjs
pnpm db:local
pnpm dev
```

`setup-secrets.mjs` creates `.dev.vars`. This file stores local secrets and stays outside Git. Use a new local password and keys for every developer.

Run the tests before opening a pull request:

```sh
pnpm test
pnpm exec wrangler deploy --dry-run
```

## Cloudflare deployment

1. Create a D1 database with `pnpm exec wrangler d1 create campus-companion`.
2. Copy the returned database name and ID into `wrangler.jsonc`.
3. Run `pnpm db:remote` to apply all migrations.
4. Set `APP_ORIGIN` to the final HTTPS Worker URL.
5. Use `pnpm exec wrangler secret put NAME` to set private values. At minimum set `PASSWORD_HASH`, `TOKEN_KEY`, `VAPID_PUBLIC_KEY`, and `VAPID_PRIVATE_KEY`.
6. Run `pnpm deploy`.

The configured cron runs every minute because reminder and digest scheduling happens inside the Worker. Check Cloudflare’s current pricing and limits before enabling Workers AI or sending large volumes of mail.

## Microsoft Outlook OAuth

Create a Web app registration in Microsoft Entra. Its redirect URI must exactly equal:

```text
https://YOUR_WORKER_HOST/api/outlook/callback
```

Add delegated Microsoft Graph permissions `User.Read`, `Mail.Read`, and `Mail.Send`. Store `MS_CLIENT_SECRET` only as a Cloudflare secret. Add the client ID as the non-secret `MS_CLIENT_ID` variable. The website encrypts refresh tokens before saving them in D1, using `TOKEN_KEY`.

## iPhone Shortcut ingestion

`POST /api/mail/shortcut` accepts mail from a personal iPhone Shortcut. Set a strong `SHORTCUT_INGEST_KEY` as a Cloudflare secret and send it as a Bearer token. Treat that shortcut key like a password. It is independent from Microsoft OAuth.

## Before production

- Test registration, sign-in, sign-out, password recovery, and direct links to private views.
- Confirm a second account cannot read the first account’s tasks, mail, or digests.
- Test a sample mail and check the extracted summary against the original.
- Test reminder delivery on a real iPhone after installing the PWA from Safari.
- Do not use real school mail or a shared inbox in local development.
