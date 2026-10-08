# Campus Companion MVP v1

## Product promise

Campus Companion helps a student group confirm who does what, see the real deadlines, and find a shared meeting time. Email, translation, and AI support this workflow; none is required to complete it.

## Demonstration journey

1. A group owner creates a Group and pastes an assignment brief.
2. The system proposes Task Candidates with evidence.
3. A reviewer corrects and confirms each candidate.
4. Proposed assignees accept or reject their responsibilities.
5. Members submit availability to a Meeting Poll.
6. The scheduler returns up to three meaningfully different Meeting Proposals with explanations.
7. Every member votes once among the locked proposals and may change that vote before confirmation.
8. The group owner confirms a highest-vote option after everyone votes.
9. The confirmed meeting appears in every member's My Tasks and in the Group announcements.

## Navigation

The primary navigation contains only **My Tasks** and **My Groups**. Settings contains language, notifications, optional connections, and data controls. Candidate review and meeting planning live inside the relevant task or Group.

## Required capabilities

- Manual personal and group tasks.
- Group membership and scoped authorization.
- Task Candidate review with evidence and explicit confirmation.
- Assignee acceptance or rejection.
- Availability collection and explainable meeting recommendations.
- One-member-one-vote meeting decisions and durable meeting announcements.
- Lightweight task comments and decision records.
- On-demand translation.
- In-app due information and opt-in push reminders.

## Deferred capabilities

- General-purpose real-time chat, presence, and read receipts.
- Voice or video meetings.
- Full semester timetable management.
- Automatic continuous chat summarization.
- File storage; the MVP stores links.
- Gmail integration and automatic external calendar booking.
- Outlook as a demonstration dependency.

## Safety invariants

- AI output is a Task Candidate, never a Task.
- Confirmation is required before reminders or assignments have effects.
- An assignee accepts their own responsibility.
- Missing availability is unknown, never available.
- Voting cannot begin until every member submits availability; confirmation cannot occur until every member votes.
- Every private query is scoped by the authenticated User or an authorized Group Membership.
- Mail connectors use delegated, least-privilege read access and never send mail.
- Raw mail bodies are not retained after structured extraction.

## Success signal

Three students who have not been coached can confirm their responsibilities and propose an acceptable meeting time in under three minutes.
