# Wheel pickers and no-typing reminders — 2026-10-18

The task form no longer needs the keyboard for times:

- **截止时间（香港）** opens a year / month / day / hour / minute wheel (`public/wheel-picker.js`). Columns support drag with inertia, snap-to-row, rubber-band overscroll, mouse wheel / trackpad, tapping a row, and the keyboard (↑ ↓, Page Up/Down, Home/End; each column is a `role="spinbutton"`). One-tap shortcuts: 今晚 23:59, 明天 09:00, 明天 23:59, 一周后. The hidden `due` input still holds `YYYY-MM-DDTHH:mm` (Hong Kong), so the API payload is unchanged.
- **截止前提醒** shows toggle chips (3 天, 2 天, 1 天, 2 小时, 30 分钟). "＋ 自定义" opens a number + unit wheel. A custom chip can be "设为默认"; saved presets are stored in `users.reminder_defaults.presets` through `PATCH /api/profile` (no migration needed). "把当前选择设为新待办默认" stores `reminder_defaults.offsets`.
- **指定提醒时间** uses "＋ 添加提醒时间" with the same date-time wheel; times appear as chips (tap to change, × to remove; past times are struck through). The API still receives `reminders.exact` as timestamps.
- **自定义间隔** opens the duration wheel (minimum 30 minutes).

Feedback: saving a task shrinks the button into a circle, draws a tick and bursts particles (`public/motion.js`). Switching pages from the navigation uses a circular reveal from the tap point (View Transitions API; other browsers switch instantly). Both are skipped with `prefers-reduced-motion`.

Pure helpers live in `public/reminder-logic.js` and are tested in `test/reminder-logic.test.js`.
