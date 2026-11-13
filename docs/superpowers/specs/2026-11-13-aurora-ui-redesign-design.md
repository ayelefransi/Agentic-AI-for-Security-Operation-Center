# Aurora UI redesign: theme, shell, dashboard and motion

Status: approved (owner said "start building"), builder-check answers in section 6
Date: 2026-11-13

## Intent

አውራ AI is used by real SOC analysts for full shifts. The owner wants the interface to look beautiful and attractive, with a new colour identity, a stronger dashboard and purposeful animation. Because analysts sit in it for hours, "attractive" must never cost speed or calm: motion is short and only signals change, density stays high, and the screen makes clear what needs attention first.

## Goals

1. Replace the current indigo-on-navy palette with the **Aurora teal** direction across the whole app.
2. Rebuild the app frame (sidebar, top bar) and the dashboard (Overview page) in the **situation-first** layout the owner chose.
3. Introduce a small, reusable motion system and apply it to the shell, the dashboard and, in its generic form, every other page.
4. Keep every existing feature working: navigation, search, notifications, incident drawer with acknowledge/escalate/close, auto-refresh, chart range toggle, severity filter, sign-out.

## Non-goals (this round)

- New layouts for Incidents, Investigations (analyze, MITRE, forensics tabs), Threat intel, Agents, Settings, Users, Audit, Login and the incident detail page. They receive the new colours and the generic motion only. Each gets its own redesign later, one page at a time.
- Backend changes. Everything in this design is computed from existing endpoints.
- A light theme. The app stays dark-only.
- Replacing CSS Modules with Tailwind or a component library.

## Anti-goals (would make this a failure even if it works)

- Motion that loops, idles, delays interaction or makes analysts wait for content.
- Changing the meaning or colour of severity (critical red, high orange, medium yellow, low green).
- Decorative effects that reduce text contrast below WCAG AA (4.5:1 body text, 3:1 large text and UI parts).
- Any visible control that does nothing.
- Breaking or silently removing an existing dashboard capability.

## Constraints

- Next.js 14 App Router, React 18, TypeScript, CSS Modules, `framer-motion` 12 (already a dependency), `lucide-react`, Geist font. No new runtime dependencies.
- All colours come from CSS custom properties in `app/globals.css`. About 30 hardcoded literals of the old accent (`#6C83FF`, `rgba(108,131,255,…)`, `#8B9FFF`, `#0B1020`) exist in `app/analyze/page.module.css` (13), `app/settings/page.module.css`, `app/mitre/*`, `app/forensics/page.module.css`, `app/incidents/[id]/page.tsx`, `Drawer.module.css` and `AppHeader.module.css`; these must be replaced with tokens so the whole app actually changes colour.
- Every animation must be disabled under `prefers-reduced-motion: reduce` (CSS media query and Framer Motion `useReducedMotion`).
- Must pass `npx tsc --noEmit -p .`, `npx next lint`, `npm run build` and the existing backend tests (unchanged).
- Layout must work at 1440 px desktop, 1024 px laptop, 768 px tablet and 375 px phone without horizontal page scroll.

## Approaches considered

1. **Theme everywhere, rebuild the shell and dashboard (chosen).** Swap the tokens so every page recolours at once; rebuild the sidebar, top bar and dashboard to the mockups; add shared motion primitives used by all pages. Fast to see, low risk to working pages; other page layouts are deferred.
2. **Redesign every page now.** Same end state in one batch, roughly three times the work, harder to review, higher regression risk, nothing visible until the end.
3. **Move to Tailwind and shadcn/ui.** Rewrites every page's styling for no visible gain over the chosen design; rejected.

The owner chose approach 1.

## Decisions made with the owner

- Audience: daily SOC analysts, not demos. Calm, fast, dense.
- Dashboard layout **B, situation first**: headline numbers with change since last shift on top, then incident volume with a compact agent panel beside it, then the "needs attention" queue.
- Colour direction **Aurora teal**: deep sea-green background, teal primary, sky-blue secondary, soft aurora glow behind the page header.
- Motion level as demonstrated in the companion demo (`.superpowers/brainstorm/*/content/motion.html`): approved.

## Design

### 1. Colour tokens (`app/globals.css`)

Replace the values, keeping the existing token names so every page picks them up:

| Token | New value |
|---|---|
| `--bg-base` | `#061417` |
| `--bg-glass` / panel surface | `#0B1E22` (solid; replaces translucent white) |
| `--bg-glass-dense` | `#0F262B` |
| `--bg-elevated` | `#0D2226` |
| `--bg-hover` | `rgba(45, 212, 191, 0.06)` |
| `--bg-active` | `rgba(45, 212, 191, 0.12)` |
| `--border-glass` | `rgba(160, 255, 240, 0.09)` |
| `--border-glass-hover` | `rgba(45, 212, 191, 0.35)` |
| `--accent` | `#2DD4BF` (teal) |
| `--accent-hover` | `#5EEAD4` |
| `--accent-ghost` | `rgba(45, 212, 191, 0.12)` |
| `--accent-border` | `rgba(45, 212, 191, 0.35)` |
| `--text-primary` | `#E9FBF8` |
| `--text-secondary` | `rgba(233, 251, 248, 0.74)` |
| `--text-muted` | `rgba(233, 251, 248, 0.56)` |

New tokens: `--accent-2: #38BDF8` (sky blue, used only in gradients and the logo mark), `--accent-contrast: #061417` (text on teal buttons), `--glow-aurora: rgba(45, 212, 191, 0.18)`, `--delta-up: #FF6B7A`, `--delta-down: #3DDC97`, plus motion tokens `--ease-out: cubic-bezier(.2,.8,.2,1)`, `--dur-fast: 120ms`, `--dur-base: 200ms`, `--dur-enter: 450ms`.

Severity tokens keep their current values. The page background gets a fixed radial aurora glow at the top-left (`radial-gradient(1200px 260px at 15% -40px, var(--glow-aurora), transparent 60%)`).

All hardcoded old-accent literals listed under Constraints are replaced with tokens. Charts and the MITRE heat scale use `--accent` instead of indigo.

### 2. App shell

**Sidebar (`AppSidebar`)**: same six items, routes and collapse behaviour. Logo mark becomes a teal-to-sky gradient square with a soft glow. Active item: teal gradient fill fading to transparent plus a 2 px teal inset bar on the left; the indicator glides between items with a Framer Motion `layoutId` animation. Hover: `--bg-hover`. Collapsed state shows icons with tooltips (existing behaviour kept).

**Top bar (`AppHeader`)**: keeps search (with the `/` shortcut hint), notifications and the user menu. The avatar becomes a teal gradient circle with initials. The notification badge pops in with a scale animation when its count increases.

**Page transitions**: content area fades and rises 8 px on route change (`AnimatePresence` keyed by pathname, 200 ms). No exit animation that delays navigation.

### 3. Dashboard (`app/dashboard/page.tsx`)

Top to bottom:

1. **Greeting header**: "Good morning/afternoon/evening, {first name}" from `fetchCurrentUser`, subtitle "Since your last shift · updated X ago", a live indicator (green dot that pulses once on each successful refresh) and the existing manual refresh button.
2. **Four headline tiles** with count-up on first load and a one-time flash when a value changes:
   - **Open incidents** (hero tile, teal gradient): count of incidents not in a closed state; delta vs. last shift.
   - **Critical / high**: open incidents with severity critical or high; delta.
   - **Avg triage time**: see section 6 for the exact rule (lower is better, so a decrease is shown in green).
   - **AI auto-closed**: incidents with status `closed_false_positive` and no analyst feedback override, created since last shift, shown as "N / total" with the percentage.
   Deltas: red up-arrow for increases in bad numbers, green down-arrow for decreases; "No change" in muted text.
3. **Middle row** (2.2 : 1):
   - **Incident volume**: area chart (line plus gradient fill) replacing the current bar chart, 24h/7d toggle kept, the highest bucket marked with a red dot, line draws in on first load. Hover tooltip shows bucket time and count.
   - **Agents**: compact list "6 / 6 healthy" with name and latency; a non-healthy agent turns its dot orange/red and moves to the top. Existing click-to-expand detail kept.
4. **Needs attention queue**: replaces "Recent incidents". Shows open incidents sorted by severity (critical first) then newest first. Each row: severity bar, verdict title, AI one-line summary, severity pill, age. Existing severity filter tabs and the incident drawer (acknowledge, escalate, close) are kept. Rows that appear during a refresh slide in with a fading red (critical) or orange (high) glow. Keyboard: `J`/`K` move selection, `Enter` opens the drawer.

**"Since last shift"**: on dashboard load, read `awra-last-shift-start` from `localStorage`. If missing, or older than 16 hours, the window is the last 8 hours. Update the stored value to now when the analyst leaves or after 16 hours of activity. Stored per browser; documented as such.

**States**: skeleton shimmer while loading (static under reduced motion), friendly empty states ("Queue is clear" with a teal check), and the existing error panel with retry.

### 4. Motion system (`app/components/motion/`)

Small, typed primitives, all no-ops under reduced motion:

- `Reveal` / `RevealGroup`: rise 8 px and fade in, children staggered 60 ms, once per mount.
- `CountUp`: animates a number from 0 (or its previous value) over 600 ms with ease-out; renders the final value immediately under reduced motion; keeps tabular numerals so width does not jump.
- `useFlashOnChange(value)`: returns a class that triggers a single 900 ms highlight when the value changes (not on first render).
- `NewItemHighlight`: wraps a list row; slide-in plus a fading severity-coloured glow when the row was not present in the previous data.
- `PageTransition`: used in `AppShell` around `children`.
- Card hover lift (translateY -2 px, border to `--border-glass-hover`, shadow) as a shared CSS class.

Rules: nothing loops; nothing over 1 second; animations never block clicks; `will-change` only on elements being animated.

### 5. Other pages (this round)

No layout changes. They inherit the new tokens, the shell, page transitions and the shared card hover. The hardcoded colour literals in them are replaced by tokens. The login page gets the aurora background and teal button through tokens only.

### 6. Data rules (settled after the builder check; builder's calls)

The backend stores only `created_at` per incident and no status history, so these rules use only what exists:

- **Shift window.** `localStorage` keys `awra-last-active` (updated on every successful dashboard load or refresh) and `awra-shift-start`. On load: if `awra-last-active` exists and is at least 4 hours old, a new shift begins and `awra-shift-start` is set to that old `awra-last-active` (the window covers what happened while the analyst was away). If neither key exists, the window is the last 8 hours. The window is capped at 7 days. Values are per browser.
- **Open** means any status except `closed`, `closed_false_positive` and `closed_resolved` (matches `/api/stats`; the decision agent marks critical and high incidents `escalated`).
- **Open incidents** tile: current open count; subline "+N new this shift" (incidents created in the window), or "No new incidents".
- **Critical / high** tile: open incidents with severity critical or high; subline "+N new this shift".
- **Avg triage time**: mean of (last `completed_at` − first `started_at`) from `agent_trace` for incidents created in the window, in seconds with one decimal (minutes above 120 s); falls back to `stats.avg_triage_seconds` labelled "all time" when the window has none. Delta against the same-length window before it, shown only when both windows have data; lower is better.
- **AI auto-closed**: incidents created in the window with status `closed_false_positive` and no `feedback.override_verdict`, shown as "N / total created in window" with the percentage; "No new alerts" when the window is empty.
- **Needs attention queue**: open incidents, critical first then newest, maximum 8 rows, with a "View all incidents" link to `/incidents`. Severity filter tabs keep counting all incidents so closed ones remain reachable through the existing filter and link. J/K moves within the visible rows.
- The token table wins wherever the brainstorm mockups disagree; mockups are layout references only.

## Verification

- Type-check, lint and production build pass.
- Manual walkthrough at 1440, 1024, 768 and 375 px: dashboard, every sidebar destination, login, incident drawer actions, chart toggle, severity filter, notifications, search, sign-out.
- With the OS "reduce motion" setting on, no element animates.
- Contrast spot-checks with axe-core in the browser on the dashboard and one other page.
- No console errors on any page.

## Left to the builder

- Exact component split inside the dashboard and file names under `app/components/motion/`.
- Skeleton, tooltip and empty-state copy and visual details within the tokens above.
- Whether the area chart is hand-rolled SVG (as today) or uses `recharts` (already a dependency); prefer whichever keeps the bundle smaller.
- How the J/K selection is indicated visually, within the tokens.
