---
name: taste-redesign
description: Audit-then-improve workflow for existing UI.
version: 1.0.0
author: TasteSkill
license: MIT
metadata:
  hermes:
    tags: [design, ui, frontend, anti-slop, taste]
    related_skills: [taste-default, taste-editorial, taste-soft-calm]
---

# TasteSkill — Redesign

A structured workflow for improving existing interfaces. Instead of rewriting from scratch, this skill audits the current design, identifies specific problems, proposes targeted fixes, and implements them with taste constraints applied. The goal is measurable improvement, not aesthetic preference.

<!--
══════════════════════════════════════════
  CONFIGURABLE DIALS — adjust these three
  values to tune behavior for your project
══════════════════════════════════════════
-->

<!-- DIAL 1: AUDIT_DEPTH — how thoroughly to examine the existing UI -->
<!-- Options: surface | structural | comprehensive -->
<!-- surface = visual issues only, structural = layout+hierarchy, comprehensive = full design audit -->
AUDIT_DEPTH: structural

<!-- DIAL 2: PRESERVATION — how much of the original to keep -->
<!-- Options: conservative | balanced | aggressive -->
<!-- conservative = minimal changes, balanced = fix problems, aggressive = substantial rework -->
PRESERVATION: balanced

<!-- DIAL 3: SCOPE — what to redesign -->
<!-- Options: component | page | system -->
<!-- component = single widget, page = full view, system = cross-page patterns -->
SCOPE: page

## When to Use

Load this when the user has an existing interface they want improved — not replaced. Trigger phrases: "clean this up," "this looks off," "redesign this page," "improve the UI," "make this not look like crap," "polish this," "why does this feel wrong?"

## Prerequisites

Access to the existing code or a screenshot/description of the current interface.

## How to Run

Provide the current UI (code, screenshot, or URL). The skill runs an audit, presents findings, then implements approved changes.

## Quick Reference

### Audit Checklist by Depth

| Check | surface | structural | comprehensive |
|-------|---------|-----------|---------------|
| Color contrast | yes | yes | yes |
| Spacing consistency | yes | yes | yes |
| Typography scale | no | yes | yes |
| Visual hierarchy | no | yes | yes |
| Alignment grid | no | yes | yes |
| Component consistency | no | no | yes |
| Responsive behavior | no | no | yes |
| Interaction states | no | no | yes |
| Accessibility | no | no | yes |
| Information architecture | no | no | yes |

## Procedure

### Phase 1: Audit

1. Read the existing code or examine the screenshot. Don't touch anything yet.

2. Run the audit checklist based on AUDIT_DEPTH. For each check, note:
   - **What's wrong** — specific, not "the spacing is off." Say which spacing, between which elements, and what it should be.
   - **Severity** — `critical` (usability problem), `major` (noticeable quality issue), `minor` (polish).
   - **Fix effort** — `trivial` (one CSS property), `small` (a few changes), `medium` (structural change).

3. Present findings as a ranked list. Group by severity, not by location. The user should see the worst problems first.

### Phase 2: Proposal

4. Based on PRESERVATION dial, propose changes:
   - **conservative**: only critical and major issues. Keep all existing design decisions intact. Fix spacing, contrast, and alignment without changing the visual identity.
   - **balanced**: critical, major, and high-impact minor issues. Allowed to adjust colors, type sizes, and layout proportions within the existing design language.
   - **aggressive**: all issues. Allowed to introduce new type pairings, restructure layout, simplify component hierarchy, and change the visual tone.

5. For each proposed change, show a before/after description. The user approves, modifies, or rejects each one.

### Phase 3: Implementation

6. Apply approved changes. Work from structural changes inward:
   - Layout and grid first
   - Typography hierarchy second
   - Spacing and alignment third
   - Color and contrast fourth
   - Polish (shadows, borders, radius) last

7. After implementation, re-run the audit at the same depth. Every issue from Phase 1 should be resolved or explicitly deferred.

8. Present the final result alongside the original for comparison. State what changed and what stayed.

## Pitfalls

- **Redesign creep** — start with what was asked for. If the user said "fix the header," don't redesign the footer too. Flag it, but don't do it unbidden.
- **Taste-washing** — applying a trendy aesthetic over structural problems. If the information hierarchy is wrong, new colors won't fix it. Fix structure first.
- **Breaking what works** — some "ugly" UI decisions are intentional for usability. Dense data tables, high-contrast alerts, ugly-but-scannable forms — check intent before polishing them into unusability.
- **Screenshot fidelity** — if working from a screenshot rather than code, note that exact values are estimates. Flag this uncertainty.

## Verification

The redesign succeeds when:
- Every critical and major audit finding is resolved
- The re-audit at the same depth produces fewer or no issues
- Original functionality is preserved — no interactive elements lost
- The before/after comparison shows specific, nameable improvements (not just "it looks better")
