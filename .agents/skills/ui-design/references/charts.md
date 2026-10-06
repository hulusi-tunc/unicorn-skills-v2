# Charts

Read only when a screen has a chart. `TASTE.md` and the colour rules in `SKILL.md` still apply.

## Pick the form from the question

| Question | Chart |
|---|---|
| Compare categories | bar; grouped bar (several series); bullet (target against actual) |
| Trend over time | line; area (volume); sparkline (inline) |
| Part of a whole | donut (two to four parts); stacked bar (more); treemap (a hierarchy) |
| Distribution | histogram; box plot; scatter |
| Relationship | scatter; bubble; heat map |

Take the simplest form that answers it. One number with its change often beats a chart.

## Marks and labels

- No decoration: gridlines a hairline or none, no borders, no 3D, no gradients.
- Bars start at zero. Axes say their unit.
- Label marks directly; a legend only when direct labels collide.
- Mark the one point that matters; context (a target, last period) is a neutral line.
- Figures in `tabular-nums`, formatted as the rest of the product formats them.

## Colour

- One series: the accent. A comparison: the accent against a neutral.
- Ordered data: steps of the accent ramp. Above and below a midpoint: the accent and one other hue
  from `TASTE.md`.
- Categories: as few hues as possible; past three, label or group instead. A new chart hue is a
  `DECISIONS.md` line.
- Never red against green as the only difference; labels, shape or pattern carry it too. Marks 3:1
  against the background and against each other.
- Web: the library's `chart` part (Recharts) wrapped as `DSChart`; point its `--chart-1` to
  `--chart-5` in `globals.css` at the tokens.

## Data and states

- Data comes through `@/api` like any screen; build and check all five scenarios. `empty`: no bare
  axes, say there is nothing yet and what adds it. `long`: thousands of points, so group by period
  instead of drawing each one. `error`: the message in the chart's place, with a retry. `slow`: a
  skeleton the chart's size, so nothing moves when it lands.
- Narrow tiers: fewer points, larger labels, or a table instead.
- Every chart has a text alternative: a one-line summary of what it shows, and the numbers as a
  table on request. Tooltips open by keyboard and touch, not hover alone; detail on demand, not all
  at once.
