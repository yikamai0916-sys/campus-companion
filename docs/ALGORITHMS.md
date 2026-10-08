# Core algorithms

## Meeting recommendations

`AvailabilityCalendar` represents free and avoided time as sorted, merged, half-open intervals `[start, end)`. Half-open intervals make adjacent classes unambiguous: a class ending at 10:00 does not overlap an interval beginning at 10:00.

For `N` submitted intervals, `U` group members, and `C` candidate starts:

1. Validate and sort each member's intervals: `O(N log N)` time.
2. Merge overlapping or adjacent intervals: `O(N)` time.
3. Generate candidate starts at the poll's fixed time granularity.
4. Sweep each member's merged intervals with a forward-only cursor while candidates increase: `O(CU + N)` time.
5. Sort scored candidates, then keep at most three whose start times differ by at least one meeting duration: `O(C log C)` time.

Total time is `O(N log N + CU + C log C)`. Working space is `O(N + U + CU)` because each candidate retains its available and unavailable member lists for the explanation returned to the client. A future bounded top-k selection could avoid retaining and sorting every candidate, but the MVP keeps all candidates so the report and implementation stay consistent.

Scores are ordered by:

1. More available members.
2. Fewer avoid-interval penalties.
3. Earlier start time.

Missing submissions are never converted to free time. A Meeting Proposal is confirmable only when every current group member submitted availability and is available for the full interval.

## Reminder ordering

D1 is the durable source of reminder records. A scheduled Worker invocation processes only one bounded batch. The planned `ReminderQueue` builds a min-heap for that batch, giving `O(log R)` insertion and removal and `O(1)` access to the earliest reminder. The heap will not be treated as durable Worker memory.
