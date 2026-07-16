---
name: taste-editorial
description: Magazine-style typographic hierarchy.
version: 1.0.0
author: TasteSkill
license: MIT
metadata:
  hermes:
    tags: [design, ui, frontend, anti-slop, taste]
    related_skills: [taste-default, taste-soft-calm]
---

# TasteSkill — Editorial

A design mode for interfaces that should read like a well-typeset magazine or long-form publication. Strong typographic contrast, deliberate asymmetry, bold headline treatments, and reading-optimized body text. For landing pages, blogs, documentation, content-heavy dashboards, and any screen where text does the heavy lifting.

<!--
══════════════════════════════════════════
  CONFIGURABLE DIALS — adjust these three
  values to tune behavior for your project
══════════════════════════════════════════
-->

<!-- DIAL 1: GRID_RIGIDITY — how strict the column structure is -->
<!-- Options: flexible | strict | magazine -->
<!-- flexible = fluid widths, strict = fixed column grid, magazine = asymmetric multi-column -->
GRID_RIGIDITY: strict

<!-- DIAL 2: TYPE_SCALE — how dramatic the size contrast is -->
<!-- Options: modest | confident | dramatic -->
<!-- modest = 1.2 ratio, confident = 1.333 ratio, dramatic = 1.5+ ratio -->
TYPE_SCALE: confident

<!-- DIAL 3: IMAGERY — role of images in the layout -->
<!-- Options: minimal | balanced | hero -->
<!-- minimal = text-first, balanced = text+image, hero = image-dominant with text overlay -->
IMAGERY: balanced

## When to Use

Load this when the output is text-heavy and the user wants it to feel polished and intentional: blog layouts, marketing pages, documentation sites, content platforms, portfolio pages, or any "editorial" reference (NYT, Medium, Stripe's docs, Apple Newsroom, The Verge).

## Prerequisites

None. Optionally, a display typeface via Google Fonts improves the result. Recommended pairings:
- Headlines: `"Playfair Display"`, `"DM Serif Display"`, `"Fraunces"`, `"Instrument Serif"`
- Body: `"Inter"`, `"Source Serif 4"`, `"Literata"`, `"IBM Plex Sans"`

## How to Run

Activates on load. Constrains typography and layout decisions to editorial standards.

## Quick Reference

| Element | Editorial Treatment |
|---------|-------------------|
| Headline | Display typeface, weight 700-900, tracking -0.02em to -0.04em |
| Subhead | Same family as headline, weight 400-500, larger line-height |
| Body | Serif or clean sans, 18-20px, line-height 1.6-1.8, measure 55-75ch |
| Caption | Small, muted, uppercase tracking 0.05-0.1em |
| Pull quote | Oversized italic, indented or outdented, visual break in flow |
| Column width | 680px single, 960px with sidebar, never full-bleed text |
| Paragraph spacing | margin-bottom equal to line-height (not double, not half) |
| Image | Full-bleed or outdented. Never smaller than the text column. |

### Type Scale by Dial Setting

| Level | Modest (1.2) | Confident (1.333) | Dramatic (1.5) |
|-------|-------------|-------------------|----------------|
| Caption | 13px | 12px | 11px |
| Body | 16px | 18px | 18px |
| H3 | 19px | 24px | 27px |
| H2 | 23px | 32px | 41px |
| H1 | 28px | 42px | 61px |
| Display | 33px | 56px | 92px |

## Procedure

1. Select a type pairing: one display face for headlines, one text face for body. If using a single family, create contrast with weight and size — not decoration.

2. Apply the type scale based on TYPE_SCALE dial. Set body text between 18-20px. Derive every other size from the chosen ratio — no ad-hoc sizes.

3. Set the reading measure (line length):
   - Single column: `max-width: 680px` for body text
   - With sidebar: text column 680px, sidebar 280px, gap 48px
   - Never let body text exceed 75 characters per line

4. Configure the grid based on GRID_RIGIDITY:
   - **flexible**: percentage-based widths, `max-width` on text, images can be any width
   - **strict**: 12-column grid, text occupies 8 columns centered, images 10-12 columns
   - **magazine**: asymmetric columns (60/40 or 70/30), text and media side by side

5. Handle images based on IMAGERY dial:
   - **minimal**: small inline images only, never wider than text column
   - **balanced**: images break out of text column (outdented) at 1.2-1.5x text width
   - **hero**: full-bleed images with text overlays, large feature images between sections

6. Set vertical rhythm: paragraph spacing equals the body line-height value. Section breaks get 2x that value. Heading spacing: 1.5x above, 0.5x below.

7. Review for editorial violations:
   - Body text wider than 75ch
   - Headings that don't use the display typeface
   - More than 4 heading levels in one page
   - Images smaller than the text column (looks accidental)
   - Missing pull quotes or visual breaks in content longer than 800 words
   - Inconsistent paragraph spacing

## Pitfalls

- **Tracking on body text.** Letter-spacing adjustments belong on headlines and captions. Body text at 18px+ with added tracking looks amateurish.
- **Too many weights.** Editorial means restraint. Use 2-3 weights maximum across the entire page. Variation comes from size, not weight collection.
- **Justified text without hyphens.** Either use `text-align: left` (safe default) or `text-align: justify` with `hyphens: auto`. Justified text without hyphenation creates rivers.

## Verification

Check the output against editorial standards:
- Body text is 18-20px with line-height 1.6-1.8
- Line length does not exceed 75 characters
- Headline uses a display typeface or bold weight with negative tracking
- Vertical spacing follows a consistent rhythm
- Images are at least as wide as the text column
- No more than 2 typefaces on the page
