---
name: taste-image-gen
description: Art direction for AI image prompts.
version: 1.0.0
author: TasteSkill
license: MIT
metadata:
  hermes:
    tags: [design, ui, frontend, anti-slop, taste]
    related_skills: [taste-default]
---

# TasteSkill — Image Generation

Art direction rules for AI image generation prompts. Prevents the default AI image aesthetic (glossy, over-rendered, uncanny) by enforcing consistent style tokens, composition principles, and prompt structure. Works with any image model — DALL-E, Midjourney, Stable Diffusion, Flux, Ideogram.

<!--
══════════════════════════════════════════
  CONFIGURABLE DIALS — adjust these three
  values to tune behavior for your project
══════════════════════════════════════════
-->

<!-- DIAL 1: REALISM — how photographic vs stylized -->
<!-- Options: stylized | balanced | photorealistic -->
<!-- stylized = illustration/graphic, balanced = polished render, photorealistic = camera-real -->
REALISM: balanced

<!-- DIAL 2: DETAIL_LEVEL — prompt specificity -->
<!-- Options: simple | standard | intricate -->
<!-- simple = short focused prompts, standard = medium detail, intricate = highly specified -->
DETAIL_LEVEL: standard

<!-- DIAL 3: CONSISTENCY — how tightly to enforce a visual style -->
<!-- Options: loose | guided | strict -->
<!-- loose = per-image freedom, guided = shared palette/mood, strict = unified style bible -->
CONSISTENCY: guided

## When to Use

Load this when the user needs AI-generated images that don't look like generic AI art: product mockups, hero images, blog illustrations, icon sets, UI placeholder art, social media graphics, presentation visuals.

## Prerequisites

Access to an image generation model through any provider. This skill writes prompts — it does not call the API directly.

## How to Run

When an image is needed, this skill generates structured prompts following the rules below. Feed the prompt to your image generation tool of choice.

## Quick Reference

### Prompt Structure

Every prompt follows this order. Omit sections that don't apply, but never reorder.

```
[STYLE] [SUBJECT] [COMPOSITION] [LIGHTING] [COLOR] [MOOD] [TECHNICAL] [NEGATIVE]
```

| Section | Purpose | Example |
|---------|---------|---------|
| STYLE | Medium and aesthetic | "flat vector illustration" / "editorial photograph" |
| SUBJECT | What's depicted | "a single espresso cup on a marble counter" |
| COMPOSITION | Framing and layout | "centered, close-up, shallow depth of field" |
| LIGHTING | Light source and quality | "soft natural side light, morning" |
| COLOR | Palette constraint | "muted earth tones, cream and terracotta" |
| MOOD | Emotional tone | "quiet, contemplative" |
| TECHNICAL | Model-specific params | "4:3 aspect ratio, high detail" |
| NEGATIVE | What to avoid | "no text, no watermarks, no hands" |

### Style Tokens by Realism Dial

| Realism | Good Style Tokens | Avoid |
|---------|------------------|-------|
| stylized | flat illustration, vector, geometric, paper cut, risograph, line art, minimal | photorealistic, hyperdetailed, 8K, unreal engine |
| balanced | editorial, clean render, product photography, studio shot, architectural | anime, cartoon, watercolor, sketch |
| photorealistic | shot on Hasselblad, 85mm f/1.4, natural light, candid, documentary | illustration, stylized, vector, flat |

## Procedure

1. Before writing a prompt, identify the image's job. What will it sit next to? What should the viewer understand in 2 seconds? An illustration for a calm app and a hero image for a sales page need completely different art direction.

2. Select style tokens based on the REALISM dial. Lock in 2-3 style descriptors and use them consistently across all images in the set.

3. Write the subject description. Be specific about what's in the frame, but don't over-specify arrangement — let the model compose. Bad: "a cup positioned at 30 degrees on the left third with steam rising at exactly 45 degrees." Good: "an espresso cup on a marble counter, steam rising."

4. Set composition in photography terms: framing (close-up, medium, wide), angle (eye-level, overhead, low), depth (shallow DOF, deep focus). One composition note per prompt — more than that conflicts.

5. Apply CONSISTENCY dial:
   - **loose**: each image gets its own style tokens. Good for varied content.
   - **guided**: define a style guide at the start of the session — palette, mood, medium — and reference it in every prompt. Good for blog series or product pages.
   - **strict**: write a style bible with exact tokens, aspect ratios, and negative prompts. Every image in the project uses the same tokens verbatim. Good for brand assets.

6. Add negative prompts to prevent common AI artifacts:
   - Always include: "no text, no watermarks, no signatures"
   - For people: "no extra fingers, no distorted hands, no uncanny expressions"
   - For products: "no floating objects, no impossible reflections"
   - For scenes: "no oversaturation, no HDR glow, no lens flare"

7. Apply DETAIL_LEVEL to prompt length:
   - **simple**: 15-30 words. Subject + style + one modifier.
   - **standard**: 30-60 words. Full structure minus technical/negative.
   - **intricate**: 60-100 words. Full structure including model-specific parameters.

8. Review prompts for anti-patterns:
   - Contradictory styles ("photorealistic watercolor")
   - Over-specified composition (more than 2 spatial instructions)
   - Missing negative prompts for known failure modes
   - Generic mood words that add nothing ("beautiful," "stunning," "amazing")
   - Duplicate modifiers ("detailed, highly detailed, ultra detailed")

## Pitfalls

- **Prompt stuffing** — more tokens doesn't mean better output. After ~80 words, additional detail causes mode collapse where the model picks some tokens and ignores others. Prioritize.
- **Style salad** — "cinematic editorial minimalist product photography in the style of Wes Anderson and Bauhaus" will produce incoherent results. Pick one lane.
- **Ignoring aspect ratio** — a 1:1 square and a 16:9 landscape need different compositions. Always specify aspect ratio and compose for it.
- **The "beautiful" trap** — words like beautiful, stunning, gorgeous, amazing are noise in prompts. They don't steer the model toward better output. Use specific aesthetic descriptors instead.

## Verification

A prompt passes when:
- It follows the STYLE → SUBJECT → COMPOSITION → LIGHTING → COLOR → MOOD → TECHNICAL → NEGATIVE order
- Style tokens match the REALISM dial
- Word count matches the DETAIL_LEVEL dial
- No contradictory style terms
- Negative prompts cover known failure modes for the subject
- If CONSISTENCY is guided or strict, tokens match the session style guide
