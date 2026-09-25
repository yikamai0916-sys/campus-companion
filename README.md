# Campus Companion

A mobile-friendly campus planner built as a progressive web app. It provides individual accounts, task reminders, school-mail summaries, Outlook connection support, and English, Simplified Chinese, and Traditional Chinese interfaces.

## What is included

- Email and password registration, sign-in, sign-out, password recovery, and per-account security questions
- Private data isolation for tasks, mail summaries, notification settings, sessions, and Outlook connections
- Tasks with due dates, editing, completed-task deletion, task-specific reminders, calendar export, and notification channels
- Mail summaries with translated labels, original-mail links, per-user deletion, optional assignment extraction, and configurable focus terms
- Per-user daily digest and late-update preferences, saved digest history, and notification delivery
- Outlook OAuth connection and a separate iPhone Shortcut mail-ingestion endpoint
- A PWA interface with iPhone installation and Web Push support

## Technology

Cloudflare Workers, D1, Cron Triggers, Static Assets, optional Workers AI, Microsoft Graph OAuth, Web Push (VAPID), vanilla HTML/CSS/JavaScript, Node.js, pnpm, and Wrangler.

## Start here

1. Read [the setup guide](docs/SETUP.md).
2. Read [the team handoff](docs/TEAM_HANDOFF.md) before changing mail, security, or scheduled jobs.
3. Copy `wrangler.example.jsonc` to `wrangler.jsonc` and add your own D1 database details.
4. Run `pnpm install`, then `node setup-secrets.mjs` to create a private `.dev.vars` file.

```sh
pnpm install
node setup-secrets.mjs
pnpm db:local
pnpm dev
pnpm test
```

## Repository safety

This repository deliberately contains no production database records, passwords, tokens, OAuth client secrets, VAPID keys, personal email addresses, Cloudflare login logs, or deployment credentials. Do not commit `.dev.vars`, local Wrangler files, logs, or secrets.

## Project structure

```text
public/       PWA interface, styles, assets, and browser-side behavior
src/          Worker routes, security, mail processing, reminders, and domain logic
migrations/   D1 schema migrations
test/         Node test suite
docs/         Team handoff and setup instructions
```

## Collaboration

Create a branch for each change, run `pnpm test`, and submit a pull request with screenshots for interface changes. Use a personal test account and sample mail only. Do not connect a shared production inbox while developing.

## License

Private course and team project. Add a license before publishing this repository publicly.
