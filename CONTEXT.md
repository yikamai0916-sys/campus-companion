# Campus Companion Domain Language

## User

A student with a private Campus Companion account. A User can belong to several Groups. Private records are always read and written through the authenticated User.

## Group

A temporary collaboration space for one assignment, presentation, or competition. A Group coordinates work; it is not a replacement for a general-purpose chat platform.

## Membership

The relationship between a User and a Group. A Membership records the member's role and whether they can manage the Group.

## Task Candidate

A proposed piece of work extracted from text or suggested by another member. A Task Candidate keeps its evidence and remains inert until reviewed. It cannot schedule reminders or appear as an accepted Task.

## Task

Confirmed work owned by one User or shared within one Group. A Task can schedule reminders and appear in My Tasks.

## Assignment Acceptance

The assignee's explicit decision to accept a proposed responsibility. A group owner can propose an assignee but cannot accept on that person's behalf.

## Availability Interval

A half-open time range `[start, end)` submitted by one member for one Meeting Poll. Missing availability is unknown, not free time.

## Meeting Poll

A request inside a Group that collects member availability for a date range and meeting duration.

## Meeting Proposal

One explainable time suggested by the scheduling algorithm. A proposal reports submitted members, available members, preference penalties, and conflicts. It is not a booked meeting until confirmed.

## Evidence

A short source excerpt that supports an extracted title, assignee, or deadline. Evidence lets a reviewer verify an AI suggestion against the original text.
