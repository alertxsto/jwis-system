---
name: taste-strict-gsap
description: GSAP animation constraints and easing rules.
version: 1.0.0
author: TasteSkill
license: MIT
metadata:
  hermes:
    tags: [design, ui, frontend, anti-slop, taste]
    related_skills: [taste-default, taste-soft-calm]
---

# TasteSkill — Strict GSAP

Animation rules for projects using GSAP (GreenSock Animation Platform). Prevents floaty, gratuitous motion by enforcing timing budgets, easing standards, and performance constraints. Every animation must justify its existence — if removing it doesn't hurt comprehension, remove it.

<!--
══════════════════════════════════════════
  CONFIGURABLE DIALS — adjust these three
  values to tune behavior for your project
══════════════════════════════════════════
-->

<!-- DIAL 1: COMPLEXITY — animation technique ceiling -->
<!-- Options: basic | intermediate | advanced -->
<!-- basic = opacity+transform only, intermediate = adds stagger+timeline, advanced = ScrollTrigger+morphs -->
COMPLEXITY: intermediate

<!-- DIAL 2: PERFORMANCE_BUDGET — how strict on runtime cost -->
<!-- Options: tight | moderate | generous -->
<!-- tight = 60fps or nothing, moderate = allow occasional layout triggers, generous = creative freedom -->
PERFORMANCE_BUDGET: tight

<!-- DIAL 3: EASING_STYLE — character of motion curves -->
<!-- Options: natural | snappy | elastic -->
<!-- natural = ease-out/power2, snappy = power3-4/steps, elastic = back/elastic/bounce (sparing) -->
EASING_STYLE: natural

## When to Use

Load this when the project uses GSAP and the user wants animation that feels professional — not a CodePen demo reel. Applies to: marketing pages with scroll animations, app transitions, data visualization reveals, interactive storytelling, product tours.

## Prerequisites

GSAP must be available in the project. This skill does not install it.

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>
```

## How to Run

Activates on load. Constrains all GSAP animation code to the rules below.

## Quick Reference

### Allowed Properties by Complexity

| Property | basic | intermediate | advanced |
|----------|-------|--------------|----------|
| `opacity` | yes | yes | yes |
| `x`, `y` | yes | yes | yes |
| `scale` | yes | yes | yes |
| `rotation` | no | yes | yes |
| `stagger` | no | yes | yes |
| `timeline` | no | yes | yes |
| `ScrollTrigger` | no | no | yes |
| `MorphSVG` | no | no | yes |
| `MotionPath` | no | no | yes |
| `width`/`height` | no | no | avoid |
| `top`/`left` | never | never | never |

### Duration Limits

| Animation Type | Min | Max | Default |
|---------------|-----|-----|---------|
| Micro (hover, toggle) | 0.15s | 0.3s | 0.2s |
| Element entrance | 0.3s | 0.6s | 0.4s |
| Section reveal | 0.4s | 0.8s | 0.6s |
| Page transition | 0.3s | 0.6s | 0.4s |
| Stagger per item | 0.03s | 0.1s | 0.05s |
| Total stagger group | — | 1.2s | — |

### Easing by Style

| Purpose | natural | snappy | elastic |
|---------|---------|--------|---------|
| Enter | `power2.out` | `power3.out` | `back.out(1.4)` |
| Exit | `power2.in` | `power3.in` | `power2.in` |
| Emphasis | `power2.inOut` | `power4.inOut` | `elastic.out(1, 0.5)` |
| Hover | `power1.out` | `power2.out` | `power1.out` |
| Scroll | `none` (linear) | `none` | `none` |

## Procedure

1. For every animation, state what it communicates. Valid answers: "this element just appeared," "this group is related," "attention goes here," "the state changed." If the answer is "it looks cool," remove the animation.

2. Set `will-change` on animated elements before the animation starts. Remove it after completion with `onComplete`. Never leave `will-change` on permanently.

3. Animate only compositor-friendly properties: `opacity`, `transform` (which covers x, y, scale, rotation). If PERFORMANCE_BUDGET is `tight`, reject any animation that triggers layout or paint.

4. Use `gsap.set()` for initial states instead of CSS. This keeps the animation definition and starting values co-located:

```javascript
gsap.set('.card', { opacity: 0, y: 20 });
gsap.to('.card', {
  opacity: 1,
  y: 0,
  duration: 0.4,
  ease: 'power2.out',
  stagger: 0.05,
});
```

5. Stagger rules: total stagger duration for a group must not exceed 1.2 seconds. If you have 30 items at 0.05s stagger, that's 1.5s — reduce to 0.04s or cap the visible set.

6. ScrollTrigger (advanced only):
   - Always set `start: 'top 80%'` or later. Elements should animate when they're clearly in view, not at the pixel they enter the viewport.
   - Never use `scrub: true` for entrance animations — scrubbed entrances feel laggy. Use scrub for parallax and progress-linked effects only.
   - Set `once: true` for entrance animations. They should play once, not replay on every scroll direction change.

7. Respect `prefers-reduced-motion`:

```javascript
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReduced) {
  gsap.globalTimeline.timeScale(20); // instant
}
```

8. Review for animation violations:
   - Any duration over 0.8s for a single element
   - Total stagger exceeding 1.2s
   - Animating `width`, `height`, `top`, `left`, `margin`, or `padding`
   - Missing `prefers-reduced-motion` handling
   - `will-change` left on elements permanently
   - ScrollTrigger without `once: true` on entrance animations
   - Elastic or bounce easing on more than one element per view

## Pitfalls

- **Stagger everything** — staggering a 3-item list is fine. Staggering 50 table rows is a performance disaster and a UX headache. Stagger groups of 4-8 maximum; beyond that, animate as a single block.
- **Entrance-only thinking** — if elements animate in but snap-disappear on route change, the experience is asymmetric. Either animate exits too, or use no entrance animation.
- **ScrollTrigger scroll-jacking** — never override native scroll behavior. ScrollTrigger should enhance scroll, not replace it.

## Verification

Check the generated GSAP code for:
- Every animation has a stated purpose
- All durations fall within the limits table
- Only `opacity` and `transform` properties are animated (tight budget)
- `prefers-reduced-motion` is handled
- Stagger totals don't exceed 1.2s
- No permanent `will-change` attributes
