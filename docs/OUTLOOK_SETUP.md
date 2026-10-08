# Outlook connector setup

The connector is implemented but remains disabled until a deployer supplies a Microsoft application and four environment values. Campus Companion uses delegated access: it reads only the mailbox selected by the signed-in user. It requests `User.Read` and `Mail.Read`; it does not request `Mail.Send`.

Microsoft documents `Mail.Read` as delegated access to the signed-in user's mailbox and supports personal Microsoft accounts. See the [Microsoft Graph permission reference](https://learn.microsoft.com/graph/permissions-reference) and [redirect URI guidance](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri).

## 1. Register the Microsoft application

1. Open Microsoft Entra admin center → **App registrations** → **New registration**.
2. Select an account type that includes personal Microsoft accounts. The current connector uses the `consumers` authorization endpoint.
3. Add a **Web** redirect URI:

   ```text
   https://YOUR_WORKER_DOMAIN/api/outlook/callback
   ```

4. Under **API permissions**, add delegated Microsoft Graph permissions:
   - `User.Read`
   - `Mail.Read`
5. Create a client secret. Copy its **value** immediately; do not commit it.

## 2. Configure local development

Create `.dev.vars` in the repository root. It is ignored by Git.

```dotenv
MS_CLIENT_SECRET=replace-with-secret-value
TOKEN_KEY=replace-with-32-byte-base64-key
```

Generate `TOKEN_KEY` with Node.js:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

In `wrangler.jsonc`, set non-secret values:

```jsonc
"vars": {
  "MS_CLIENT_ID": "your-application-client-id",
  "APP_ORIGIN": "http://localhost:8787"
}
```

The local redirect URI must also be registered in Microsoft Entra if it is used for local OAuth testing.

## 3. Configure Cloudflare deployment

Set `MS_CLIENT_ID` and the public production `APP_ORIGIN` in the deployed Worker configuration. Store secrets with Wrangler:

```powershell
pnpm exec wrangler secret put MS_CLIENT_SECRET
pnpm exec wrangler secret put TOKEN_KEY
```

Apply migrations and deploy only after the production redirect URI exactly matches the URI registered with Microsoft.

## 4. Verify

1. Open **Settings → Outlook school mail**.
2. Confirm that no missing-configuration names are shown.
   Placeholder values such as `REPLACE_WITH_...` are treated as missing, and `APP_ORIGIN` must match the origin currently serving the app.
3. Connect the personal Outlook mailbox that receives forwarded school messages.
4. Verify the Microsoft consent page requests read access and does not request send access.
5. Run **Sync now** and check that only school-forwarded messages appear.

Disconnecting Outlook deletes the stored authorization for that Campus Companion account. Existing structured summaries remain until the user deletes them.
