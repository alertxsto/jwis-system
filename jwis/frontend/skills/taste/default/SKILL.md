---
name: taste-default
description: Core anti-slop design rules for UI output.
version: 1.0.0
author: TasteSkill
license: MIT
metadata:
  hermes:
    tags: [design, ui, frontend, anti-slop, taste]
    related_skills: [taste-soft-calm, taste-editorial, taste-strict-gsap, taste-redesign, taste-complete-output, taste-image-gen]
---

# TasteSkill — Default

Core design-quality rules that prevent generic, sloppy UI output. This skill does not impose a specific aesthetic — it enforces the structural fundamentals that separate intentional design from AI slop.

<!--
══════════════════════════════════════════
  CONFIGURABLE DIALS — adjust these three
  values to tune behavior for your project
══════════════════════════════════════════
-->

<!-- DIAL 1: STRICTNESS — how aggressively to reject weak output -->
<!-- Options: low | medium | high -->
<!-- low = gentle suggestions, medium = firm corrections, high = refuse to ship sloppy work -->
STRICTNESS: high

<!-- DIAL 2: VERBOSITY — how much to explain design decisions -->
<!-- Options: silent | annotated | teaching -->
<!-- silent = just do it, annotated = brief inline notes, teaching = explain the why -->
VERBOSITY: annotated

<!-- DIAL 3: SCOPE — scale of design enforcement -->
<!-- Options: component | page | system -->
<!-- component = single elements, page = full views, system = cross-page consistency -->
SCOPE: page

## When to Use

Load this skill on any task that produces visible UI: new components, page layouts, dashboards, forms, landing pages, settings screens. It applies equally to HTML, React, Vue, Svelte, or any framework that renders to a screen.

## Prerequisites

None. This skill uses no external tools or APIs — it is a set of design constraints the agent applies during code generation.

## How to Run

This skill activates automatically when loaded. It modifies how the agent writes UI code — no explicit invocation needed.

## Quick Reference

| Principle | Rule |
|-----------|------|
| Spacing | Use a consistent spacing scale (4, 8, 12, 16, 24, 32, 48, 64). No magic numbers. |
| Typography | Maximum 2 typefaces. Define a type scale and stick to it. |
| Color | Maximum 1 accent color + neutrals. Derive shades from the same hue. |
| Contrast | WCAG AA minimum (4.5:1 body text, 3:1 large text). |
| Alignment | Every element aligns to a visible or implied grid. No orphaned offsets. |
| Hierarchy | Every screen has exactly one primary action. One. |
| Density | Default to generous spacing. Density is earned by user need, not saved by laziness. |
| Borders | Prefer spacing and background shifts over visible borders. Borders are a last resort. |

## Procedure

1. Before writing any UI code, identify the single most important action on the screen. If you cannot name it in one phrase, the design is confused — resolve this first.

2. Choose a spacing scale and commit to it. Every margin, padding, and gap value must come from the scale. If you reach for a number not on the scale, stop and ask why.

3. Set the type hierarchy: one size for body, one for headings, one for captions. Three levels maximum per component. Size jumps should be perceptible — a 2px difference is invisible and wastes a level.

4. Pick one accent color. Derive hover, active, and disabled states by adjusting lightness — not by picking unrelated colors. Neutral palette: 2-3 grays maximum.

5. Build the layout from the content out, not from a grid in. The content's natural grouping determines the layout — a premature 12-column grid forces content into arbitrary slots.

6. After writing the code, review it for these red flags:
   - More than 3 font sizes in one view
   - Spacing values that aren't from your scale
   - Multiple competing accent colors
   - Text below 4.5:1 contrast ratio
   - More than one primary-styled button in view
   - Borders used where spacing or background tint would work
   - Shadows on more than 2 elevation levels

7. Fix every red flag before presenting the output. If STRICTNESS is `high`, do not present code that violates these rules.

## Pitfalls

- **"Make it pop"** — if asked to make something stand out, increase contrast or weight. Do not add gradients, shadows, borders, and color simultaneously. One lever at a time.
- **Icon soup** — icons without labels are ambiguous. Default to label + icon, not icon alone.
- **Premature dark mode** — get light mode right first. Dark mode is a separate design pass, not `filter: invert(1)`.
- **Responsive afterthought** — if the layout doesn't have a clear single-column mobile story, it's not done.

## Verification

Read through the generated code and confirm:
- All spacing values come from the declared scale
- No more than 2 typefaces and 3 type sizes per view
- One accent color with derived states
- One clearly primary action per screen
- Zero magic-number margins or paddings
