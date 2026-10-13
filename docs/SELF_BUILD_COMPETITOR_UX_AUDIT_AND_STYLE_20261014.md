# Self-Build Design Audit — competitor inspection and Celebration redesign (14 Oct 2026)

## Public competitor websites inspected

| Store / inspected page | Pattern observed | Application to Celebration |
|---|---|---|
| [BoxUp Luxury Gifting](https://www.boxupgifting.com/) and [collection](https://www.boxupgifting.com/collections/gift-hampers) | Distinct “Make Your Own Hamper” entry point, products grouped around gifting and occasions, separated budget discovery. | Keep the existing category-first progression and show an unmistakable action for opening each public gift category. |
| [HappyGifts](https://www.happygifts.in/) | Simple “select box → products → greeting card” progression with prominent gift categories and budget entry points. | Keep the three-stage navigation, make category choices obvious without crowding the screen with copy. |
| [Angroos Build a Hamper](https://angroos.in/build-a-hamper) | Clear initial approach choice and short step-by-step narrative; handmade presentation. | Use crisp titles and uncluttered navigation rather than decorative gradients. |
| [FNP Personalised Hampers](https://www.fnp.com/personalised-hampers-lp) | Readable gift-category/product discovery: clear visual hierarchy and titles; structured browse/sort surfaces. | Distinct category headings, consistent selection states, mobile-first spacing. |

This was a public website/page and content inspection, **not** permission to copy another site's source, imagery or branding. No claim of an exact visual duplicate. The sites use product photography because they have actual product images; Celebration's Self-Build is **category-based**, with no SKU mapping or approved category images, so do **not** add fabricated product visuals.

## Decisions implemented

1. **Replace colour clash:** Remove deep-purple/magenta/champagne gradients in the Self-Build tiers. Use existing Celebration cream `#fcf8f1`, ivory `#fffdfa`, warm dark text `#34241e` and wine `#7b1420`; reserve solid wine for the **selected** tier.
2. **Preserve bars for tiers:** A single vertical list, flat ivory bars, bold name and shipping-inclusive final price only. Exact DB-catalog tier IDs and original prices are unchanged.
3. **Redesign CATEGORY cards:** Bold editorial labels, small index, limited option counts, obvious round arrow action; two columns for available width, one readable column on narrow phones. No fake icons, illustrative stars, SKU details or internal costs.
4. **Redesign option/category selection cards:** Subtle selected state, short helper text, large legible titles and 44-pixel +/- targets. Preserve original quantity and per-tier maximum logic.
5. **Keep launch and privacy boundaries:** Admin preview authenticated, no payment/order/network mutation; actual buyer checkout database-gated OFF; no changes to existing backend payment flow, inventory, R2 photo deletion, monetary budget, admin data, or product selection rules.

## Verification

- Run `npm run audit` + Next/TypeScript CI and the isolated **four-viewport** admin-preview browser QA.
- Confirm tier price remains original published tier + **₹50 inclusive delivery**, with private 80% / 75% tier gift budget computed solely from original unmodified base price.
- Confirm phone widths 320px and 390px have no horizontal overflow.
- Do **not** turn on `self_build_configuration.customer_enabled` until user explicitly requests launch and real photo-deletion verification has been completed.
