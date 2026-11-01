# Animation ownership audit

29 October 2026 — scope: application-wide motion triggers and competing effects.

## Repairs

- Routed content has one entrance owner: the Gentle Lift page transition. Global
  panel, list-item and media introductions no longer run inside `#route-scene`,
  including after a local data update or DOM replacement.
- Reveal observers recheck eligibility when delivering a callback. A panel
  registered before a parent transition cannot start a stale nested entrance.
- List layout changes and exit ghosts skip an active page transition. Structural
  list feedback remains local when there is no page transition.
- Media/icon feedback respects panels, lists, dialogs, navigation and explicitly
  local component scopes instead of adding a second entrance.
- Page motion cancels on input, change and click as well as pointer, keyboard and
  focus interactions. Native select changes cannot leave a page effect running.
- Sidebar layout capture/play skips active page motion.

## Automated coverage

`tests/components/motion-ownership.test.js` mounts the complete application,
including its global motion scopes, and deliberately delivers observer callbacks.
It covers dashboard, assessment list, builder, question bank, result register,
result detail, assignment grading, student assessments, instructions, active
attempt, submitted-attempt review, and student results (12 routes).

Interaction cases include repeated grade-course changes, combined result
filters and empty results, assessment search, question-bank search, and opening
the question editor dialog. Regressions also cover delayed callbacks, list/page
overlap, icon/media ownership, native input/change/click cancellation and sidebar
layout/page overlap.

Existing engine, navigation, overlay, atom, list, page, capability, reduced-motion,
opt-out, focus, interruption and disposal suites also pass. The Motion Lab keeps
its explicit demonstration effects; it remains outside automatic page transitions.

Final verification: `npm run check` passed — 18 Node tests plus 165 component
tests (183 total), motion source guard, and production build.

## Browser verification

On the production preview, changing courses four times on desktop and twice on
mobile left the route, shell, main content and every panel without animated inline
transform, opacity or will-change styles. The page-motion marker remained absent.
The help dialog opened and closed independently. No browser errors or warnings
were logged during these checks.

The browser pass spot-checked these interactions; the route matrix and existing
suites provide the wider automated sweep. This is not a claim that every possible
sequence of controls was exercised manually.
