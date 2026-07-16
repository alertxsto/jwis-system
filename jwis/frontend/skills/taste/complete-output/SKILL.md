---
name: taste-complete-output
description: Forces complete files, zero placeholders.
version: 1.0.0
author: TasteSkill
license: MIT
metadata:
  hermes:
    tags: [design, ui, frontend, anti-slop, taste]
    related_skills: [taste-default]
---

# TasteSkill — Complete Output

Eliminates the most common AI coding failure: incomplete output. No placeholder comments, no truncated files, no "add more items here," no skipped sections, no lazy ellipses. Every file is production-complete the first time. This skill is about output discipline, not aesthetics.

<!--
══════════════════════════════════════════
  CONFIGURABLE DIALS — adjust these three
  values to tune behavior for your project
══════════════════════════════════════════
-->

<!-- DIAL 1: FILE_LENGTH — how much code to generate per file -->
<!-- Options: concise | standard | exhaustive -->
<!-- concise = minimal viable, standard = complete feature, exhaustive = all edge cases -->
FILE_LENGTH: standard

<!-- DIAL 2: COMMENTS — inline documentation level -->
<!-- Options: none | minimal | documented -->
<!-- none = zero comments, minimal = only non-obvious logic, documented = JSDoc/section headers -->
COMMENTS: minimal

<!-- DIAL 3: TEST_COVERAGE — whether to generate tests alongside -->
<!-- Options: none | basic | full -->
<!-- none = no tests, basic = happy path, full = happy + error + edge cases -->
TEST_COVERAGE: none

## When to Use

Load this on any code generation task where incomplete output has been a problem, or preemptively on tasks that tend to produce long files: full page layouts, multi-component views, config files, data-heavy components, form implementations, API route handlers.

## Prerequisites

None. This is a behavioral constraint, not a tool.

## How to Run

Activates on load. Modifies how the agent writes and validates its own output before presenting it.

## Quick Reference

### Banned Patterns

These patterns must never appear in output. Their presence means the file is incomplete.

| Banned Pattern | What It Signals |
|---------------|-----------------|
| `// TODO` | Unfinished work |
| `// ...` | Truncated code |
| `/* more items */` | Lazy repetition |
| `// add more here` | Incomplete |
| `// similar to above` | Skipped duplication |
| `// rest of the component` | Truncated |
| `// handle other cases` | Missing logic |
| `// implement later` | Placeholder |
| `// etc.` | Vague incompleteness |
| `{/* ... */}` | JSX truncation |
| `...` (as code, not spread) | Ellipsis truncation |
| `// your code here` | Template placeholder |
| `// existing code` | Pretending code exists |

### Completeness Checklist

| Check | Required |
|-------|----------|
| File renders/compiles without errors | Always |
| All imports resolve to real modules | Always |
| All functions have bodies | Always |
| All event handlers are implemented | Always |
| All conditional branches have content | Always |
| All list/grid items are populated (min 5-8 realistic items) | Always |
| Form validation is implemented, not stubbed | Always |
| Error states are handled | standard+ |
| Loading states are implemented | standard+ |
| Empty states are implemented | exhaustive |
| Responsive breakpoints are included | exhaustive |

## Procedure

1. Before writing, estimate the file length. If it will exceed your output limit, split the task into multiple files — each one complete — rather than producing one truncated file.

2. Write the file top to bottom. Do not skip sections with the intent to fill them in later. Every line in the output is final.

3. For data-driven components (tables, lists, grids, dropdowns), populate with realistic content:
   - Names: use real-sounding names, not "User 1, User 2"
   - Dates: use plausible dates relative to today
   - Numbers: use varied, realistic values — not round numbers or sequential IDs
   - Text: write real labels and descriptions, not "Lorem ipsum" or "Description here"
   - Images: use placeholder services (`https://picsum.photos/`) with varied dimensions, or inline SVG placeholders
   - Minimum 5 items for lists, 8 rows for tables

4. Apply COMMENTS dial:
   - **none**: zero comments in the output. The code is self-documenting through naming.
   - **minimal**: comments only where the code does something non-obvious. A well-named function doesn't need a comment explaining what it does.
   - **documented**: JSDoc on exports, section separator comments for long files, brief inline notes on complex logic.

5. Apply TEST_COVERAGE dial if not `none`:
   - **basic**: one test file covering the happy path — component renders, form submits, API returns expected data
   - **full**: happy path + error states + edge cases (empty data, long strings, missing fields, network failure)

6. After writing, scan the output for every pattern in the Banned Patterns table. If any match, the file is not done — fix it before presenting.

7. Mentally execute the file: does it import modules that exist? Does it reference variables that are defined? Does it call functions that are implemented? If any answer is no, the file is incomplete.

## Pitfalls

- **Splitting too eagerly** — splitting into 12 tiny files is worse than one complete 300-line file. Split only when a file would genuinely exceed output limits or when architecture demands it.
- **Realistic data obsession** — 8 table rows of plausible data is enough to validate the layout. You don't need 50 rows of hand-crafted personas.
- **Test file completeness** — the same rules apply to test files. A test file that says `// add more tests` is just as incomplete as a component that says `// add more items`.

## Verification

The output passes when:
- Zero matches for any pattern in the Banned Patterns table
- The file would render/compile if dropped into the project right now
- All imports reference real or project-standard modules
- Data-driven elements have at least 5 realistic entries
- No function bodies are empty or stubbed
