# Monochrome theme — 2026-10-18

Replaces the warm "paper" palette (`public/paper.css` removed). All design tokens live at the top of `public/theme.css`:

- Colours: page `#F5F5F5`, cards white, text / dark cards `#111111`, navigation `#1C1C1E`, grey `#8E8E93` (icons on dark) and `#6E6E73` (secondary text on light, for AA contrast). One accent at a time: lime `#D4FF00` (active nav, success), lavender `#E8E3FF` (wheel band, progress start), yellow `#FFD60A`, orange `#FF5C00` (urgent).
- Shape: cards 28–32px radius, buttons / chips / nav pills `9999px`, soft diffuse shadows instead of borders.
- Type: heavy large numbers and headings, tiny bold caps labels (11px, 2px letter-spacing), tabular numerals.
- Motion: spring easing `cubic-bezier(.34,1.56,.64,1)`; everything is disabled under `prefers-reduced-motion`.

Layout: on phones the navigation is a floating dark pill 24px above the bottom; on desktop it is a floating dark sidebar. The progress card colour moves lavender → yellow → lime with completion (`progressColor()` in `public/motion.js`) and shows a big `done/total`. Daily digests are a stacked card pile that fans out (`setupCardStack()`).

Every native `<input type="datetime-local">` / `<input type="time">` (task reminder window, group meeting range, availability rows, candidate/mail-suggestion due dates, digest times in Settings) is upgraded to the wheel picker by `public/native-pickers.js`; the hidden input keeps the same value format, so no form code or API changed. Example placeholders ("例如…") were removed from all inputs.
