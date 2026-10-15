# Collaboration workflow update

Based on PR #2 (`codex/mvp-foundation`). Review this change after that PR.

## User-visible changes
- Invitations require the recipient to accept in My Groups before membership is granted.
- Owners can transfer ownership or remove members; members can leave after outstanding assignments and active meetings are resolved.
- Assignment emails create account-private review cards. Users can correct title, notes and deadline, then confirm or dismiss. Only confirmation creates a task and reminder jobs.
- Owners can cancel meetings or reopen availability collection for a new date range. Old generated tasks, pending reminders, votes and availability are removed. Revision checks prevent stale operations.
- Simplified Chinese uses canonical source text rather than traditional translations. Dynamic content is localized; user-authored names and evidence are retained.
- Email reminders are explicitly unavailable. Outlook remains read-only; device push is the supported delivery channel. A test notification requires a configured push service and an existing subscription.

## Deployment
1. Back up the existing D1 database. Do not commit exports or private configuration.
2. Apply migrations in sequence, including `0012_review_and_membership.sql`. Existing production instances on 0007 must also apply 0008–0011.
3. Deploy with the existing database binding, secrets, environment variables and cron schedule preserved.
4. Verify anonymous private URLs redirect to home, API calls require login, and account records remain isolated.

## Validation and limitations
Run `pnpm test`, syntax checks and browser smoke tests. Tests cover invitation acceptance and replay, outsider rejection, mail suggestion deduplication and explicit confirmation, ownership transfer, meeting cancellation, reminder removal and stale revisions.

Email sending, automatic chat/pasted-text AI extraction, and real-device push delivery are not included in this update. Original user content is not machine-translated by the interface dictionary. Mail translation still depends on the existing configured AI/localization pipeline. Previously imported mail is not automatically re-imported; new synchronization creates review cards, and supported reprocessing creates them for analyzed assignment messages.
