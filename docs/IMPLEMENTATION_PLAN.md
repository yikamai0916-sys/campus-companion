# MVP implementation plan

Each phase must remain usable without later phases and ships with its own tests.

| Phase | Deliverable | Acceptance signal |
| --- | --- | --- |
| 0 | Reviewable repository | Source is tracked, tests and local setup are reproducible. |
| 1 | Secure foundation | Cross-account identifiers can coexist; notifications cannot cross account scope; Outlook is read-only. |
| 2 | Manual collaboration | A Group can create, assign, accept, update, and list Tasks without AI or email. |
| 3 | Meeting planning | Members submit intervals; the algorithm returns explained, diverse proposals and handles no-overlap cases. |
| 4 | AI-assisted review | Pasted text produces evidence-backed Task Candidates; failures preserve the source draft. |
| 5 | Translation and reminders | Translation is on demand; confirmed items alone create reminder work. |
| 6 | Product finish | Mobile flow, accessibility, user testing, complexity evidence, and report artifacts are complete. |

## Module seams

- `Collaboration`: Group membership, Task Candidate transitions, assignee acceptance, and authorization.
- `MeetingPlanner`: interval validation, normalization, intersection, scoring, and proposal diversity.
- `ReminderQueue`: heap ordering for one scheduled processing batch; D1 remains the durable source of truth.
- `TextAssistant`: extraction and translation behind one interface with deterministic fallback behavior.
- `MailConnector`: optional Outlook adapter that returns source material and has no authority to create Tasks.

Adapters call these modules. Worker routes do not reproduce domain rules.
