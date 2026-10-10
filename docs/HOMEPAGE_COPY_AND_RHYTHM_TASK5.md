# Task 5 — Homepage copy and editorial rhythm

**Date:** 2026-10-10  
**Source of truth:** [FINAL_POLISH_AND_AI_FEEL_REMOVAL.md](./FINAL_POLISH_AND_AI_FEEL_REMOVAL.md)  
**Staging:** `feat/final-polish-task2-media-cards-20261010`, PR #91 — **leave unmerged until final batch**.

## Source audit — what caused the repeated template tone

Previous homepage copy was dominated by very similar emotional formulas: “A little thought. A lot of love.”, “Gifts that speak from the heart”, “feels right”, “Make it feel like them”, “everything in between” and variations of “your way”/“for every occasion.” Several adjacent sections repeated the same promise instead of telling shoppers what the next action actually does.

This is a **source-level copy audit**, not an assertion that an outside reviewer has scored the page as AI-written. The original Celebration brand name, burgundy/cream styling and official **“Mharo Surprise, Thari Smile”** tagline remain unchanged.

## Edits implemented

| Home surface | New direction | Preserved functional contract |
| --- | --- | --- |
| Hero | “Jewelry to wear. Hampers to give.”; directly name necklaces, rings, bracelets and budget-led hampers | Optimized hero images, main hamper anchor, jewelry route, dynamic genuine minimum price |
| Shopping categories | “Shop by category”; use direct “Browse pieces” CTA | Live category names and exact original same-SKU photos |
| Featured jewelry | “Take a closer look”; a short factual editorial label | Same active product selection, URLs, sale prices, badges and cart |
| Jewelry/hamper campaign panels | “Rings, necklaces and more”; “Start with your budget” | Existing campaign assets and existing jewelry/budget navigation |
| Budget selection | Full hamper price explained once in the intro; clear alternate-budget request | No changed tier prices, inventory, quantities, selection or builder state |
| Occasions | “Birthday, anniversary or just because”; explain that choosing one starts the hamper | Dynamic occasion list and selection callback |
| Benefits and promise | Payment confirmation, tracking and packing **only where available** | No fabricated trust guarantees, order counts, packing videos or coverage |
| Custom request + final CTA | Ask for actual budget, occasion and gift preferences | Original endpoint, validation, submission and review flow preserved |

**Note about embedded imagery:** Task 5 changes **website HTML/text and layout only**. Any generic tagline permanently printed into a product image remains a pending **Task 2 verified-asset** issue and is not obscured or edited.

## Layout rationale

- Distinct section rhythm follows shopping priorities instead of injecting random offsets: browse categories → close-up product cards → split jewelry/hamper campaign → budget decision → occasions → trust and custom request.
- Desktop editorial photo panels use a restrained **1.07fr / 0.93fr** ratio; phone panels stack in the original reading order.
- Category intro and featured-card sections use different top/bottom space. Budget selection gets more separation from adjacent sales panels.
- Copy sits against the existing high-contrast hero photo overlay. No white product spaces, hidden interactive controls, or unsupported sticky UI.
- Task 4 six-link mobile navigation and 44/48px targets remain untouched. Phone rules account for <=700px and <=360px.
- CSS scope is **`.celebrationHome` only**; no cart/checkout/admin/product data design changes.

## Verification

Automated assertions live in `scripts/test-homepage-human-copy-task5.mjs` and are part of `npm run audit`. The existing `test-editorial-polish.mjs` checks are updated to test the new wording while preserving original page navigation. `test-final-mobile-navigation.mjs` verifies its scoped rules still precede this homepage-only CSS.

Check CI for `npm run audit` and `npm run typecheck` on PR #91. It is **not** proof of visual quality by itself.

### Final manual visual QA — pending

Run a staged browser build and capture before/after at **320, 360, 375, 390, 430, 768, 1024 and 1440px**. Check:

1. Hero heading and subcopy do not collide with image caption, CTA buttons or sticky nav.
2. Both shopping links, category links, product cards, custom request and budget selection work; their labels tell customers what they will do.
3. Desktop 1.07fr/0.93fr panels retain readable, non-cropped image subjects; mobile panels stack without horizontal body overflow.
4. Longer 2-line headings and new promise text fit inside the four benefit tiles and tier cards, including on a 320px Android phone.
5. Real copy, photo sequence, brand identity, checkout expectations and keyboard/touch flow feel cohesive rather than mechanically uniform.
6. Confirm packing-video wording matches actual order eligibility and current policy.
7. Retain screenshot/viewport/browser evidence before marking manual QA as complete.

**Current limitation:** This PR was not deployed to production or inspected in a real mobile browser as part of Task 5. All manual results stay pending.

## Release instruction

Per owner request: **do not merge and deploy after this task**. Continue Task 6, 7, 8 and 9 in the same PR branch. Complete automated and manual release checks, then one consolidated production release.
