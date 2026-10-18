# Paper UI — 2026-10-18

Warm off-white surfaces, charcoal text/buttons and muted brown accents replace the green interface. Shared styles cover tasks, groups, mail, settings, authentication and dialogs. The task header shows the completion ratio of all stored tasks (not only today's tasks).

Completion feedback starts only after the API confirms the change. The row briefly celebrates, the ring and count update, and an eight-second Undo action can reopen the task. Reduced-motion preferences skip the celebration and transitions. API errors retain the existing error message flow. Digest titles/dates remain visible; native keyboard-accessible disclosure controls reveal each summary, with a subtle stacked-paper treatment.

Validation: 39 automated tests; local browser check of task view, successful completion (0% to 100%), and Undo (100% to 0%). New interface copy has simplified Chinese, traditional Chinese and English mappings. Device-specific touch testing and real-device push delivery are not covered by this UI check.

Remaining optional ideas: time wheels, scroll-snapping timelines, circular navigation transitions. These are deliberately outside this iteration.
