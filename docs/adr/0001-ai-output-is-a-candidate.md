# ADR 0001: AI output remains a candidate until reviewed

## Status

Accepted

## Context

Assignment briefs and group messages can contain ambiguous owners and deadlines. Directly creating tasks or reminders from model output saves clicks but can assign the wrong student or create a false deadline.

## Decision

All extracted work enters the domain as a Task Candidate with field-level Evidence. A reviewer may edit, reject, or confirm it. Confirmation creates a Task; a proposed assignee must then accept their own responsibility. No reminder is scheduled before these transitions complete.

## Consequences

The flow requires explicit review steps and more state transitions. It also makes failures visible, keeps manual operation available, and gives the course report a testable domain model instead of treating AI text as trusted data.
