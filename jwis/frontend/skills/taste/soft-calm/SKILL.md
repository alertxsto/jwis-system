---
name: taste-soft-calm
description: Muted, warm, whitespace-heavy aesthetic.
version: 1.0.0
author: TasteSkill
license: MIT
metadata:
  hermes:
    tags: [design, ui, frontend, anti-slop, taste]
    related_skills: [taste-default, taste-editorial]
---

# TasteSkill — Soft & Calm

An aesthetic preset for interfaces that should feel quiet, unhurried, and warm. Think: meditation apps, personal journals, reading environments, settings pages that respect your attention. This skill layers on top of the default taste rules — it does not replace them.

<!--
══════════════════════════════════════════
  CONFIGURABLE DIALS — adjust these three
  values to tune behavior for your project
══════════════════════════════════════════
-->

<!-- DIAL 1: WARMTH — color temperature of the palette -->
<!-- Options: warm | neutral | cool -->
<!-- warm = cream/amber tints, neutral = true grays, cool = blue-gray tints -->
WARMTH: warm

<!-- DIAL 2: DENSITY — how much whitespace to use -->
<!-- Options: airy | balanced | compact -->
<!-- airy = maximum breathing room, balanced = comfortable, compact = still calm but tighter -->
DENSITY: airy

<!-- DIAL 3: MOTION — animation presence -->
<!-- Options: none | subtle | gentle -->
<!-- none = static, subtle = fade-ins only, gentle = soft transitions + scroll effects -->
MOTION: subtle

## When to Use

Load this skill when the user requests interfaces described as: calm, soft, minimal, quiet, peaceful, zen, understated, breathing room, low-stimulation, or references products like Notion (empty states), Linear (settings), Day One, Bear, or Apple Notes.

## Prerequisites

None. Pure CSS aesthetic — no external dependencies.

## How to Run

Activates on load. Applies the soft-calm aesthetic constraints to all UI code generated in this session.

## Quick Reference

| Element | Soft-Calm Treatment |
|---------|-------------------|
| Background | Off-white: `#FAFAF8` (warm), `#F8F8F8` (neutral), `#F6F8FA` (cool) |
| Text | Never pure black. Use `#2C2C2C` (warm) or `#1F2937` (cool) |
| Accent | One muted tone: sage `#7C9A82`, dusty blue `#6B8CAE`, clay `#C4977A` |
| Borders | `1px solid` with 6-8% opacity of foreground color. Prefer none. |
| Shadows | Single layer, large blur (20-40px), 3-5% opacity. No stacking. |
| Radius | 8-12px on cards, 6-8px on inputs, 4px on small elements |
| Font weight | 400 body, 500 headings. Never 700+ unless it's a page title. |
| Line height | 1.6-1.75 for body. Generous. |
| Padding | 24px minimum on containers. 16px minimum on interactive elements. |
| Transitions | 200-300ms ease-out. No bouncing, no elastic, no overshoot. |

## Procedure

1. Set the background color based on WARMTH dial. The background is the foundation — everything else derives from it.

2. Choose body text color: dark enough for AA contrast against the background, but never `#000`. Test the pairing.

3. Select one muted accent. Saturate it less than your instinct says to — if it looks vivid against the soft background, it's too much. Desaturate 10-20% from your first pick.

4. Set spacing using the DENSITY dial:
   - **airy**: page padding 48-64px, section gaps 40-48px, element gaps 16-24px
   - **balanced**: page padding 32-40px, section gaps 24-32px, element gaps 12-16px
   - **compact**: page padding 24-32px, section gaps 16-24px, element gaps 8-12px

5. Typography: use the lightest weight that's still legible. 400 for body, 500 for section headers, 600 only for the page title. Inter, system fonts, or a humanist sans-serif.

6. Apply MOTION settings:
   - **none**: no transitions, no animations
   - **subtle**: `opacity` transitions on mount (200ms ease-out), hover state transitions (150ms)
   - **gentle**: above plus scroll-triggered fade-up on sections (300ms, `translateY(8px)` start)

7. Review for violations:
   - Any color with saturation above 60% is probably too loud
   - Any shadow with opacity above 8% is too heavy
   - Any font-weight above 600 in body content is too aggressive
   - Any transition under 150ms or over 400ms breaks the calm rhythm

## Pitfalls

- **Calm does not mean empty.** Whitespace serves hierarchy. If the page looks blank, you removed content — not clutter.
- **Low contrast trap.** Soft palettes invite unreadable text. Check contrast ratios — calm is useless if people can't read it.
- **Hover states still matter.** Subtle doesn't mean invisible. Hover changes should be perceptible: a background tint shift of at least 3-4% lightness.

## Verification

Confirm the output looks calm by checking:
- Background is off-white, not pure white
- No pure black text anywhere
- Accent color saturation below 60%
- Shadows use a single layer with large blur and low opacity
- All transitions are 150-400ms with ease-out or ease-in-out
- Interactive elements have visible but gentle hover feedback
