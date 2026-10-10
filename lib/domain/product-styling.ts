import type { GiftProduct } from "./catalog"

/** Verified catalog category determines advice; a title is used only when
 * there is no category. Never infer metals, stones, fit or actual contents. */
export type ProductStylingAdvice = {
  intro: string
  ideas: readonly string[]
  care: readonly string[]
  pairingNote?: string
  heading: string
  categoryKind?: "set" | "necklace" | "earrings" | "ring" | "wristwear" | "gift"
}

const jewelryCare = [
  "Apply perfume or lotion before putting on the jewelry.",
  "Remove it before showering, swimming or exercise.",
  "Wipe with a soft, dry cloth and store separately."
] as const

const giftCare = [
  "Check the item details for specific storage or care instructions.",
  "Keep the gift clean and protected before giving it."
] as const

export function stylingAdviceForProduct(product: Pick<GiftProduct, "category" | "name">): ProductStylingAdvice {
  const category = (product.category || "").trim().toLowerCase()
  const name = (product.name || "").trim().toLowerCase()
  // When a category is present, trusting a product title can silently turn a
  // gift box or keychain into jewelry. Unknown categories remain neutral.
  const source = category || name

  const hasNecklace = /\b(?:necklaces?|pendants?|lockets?)\b/.test(source)
  const hasEarrings = /\b(?:earrings?|studs?|hoops?)\b/.test(source)
  const isSet = hasNecklace && hasEarrings
  if (isSet) {
    return {
      categoryKind: "set",
      heading: "How to Style",
      intro: "A necklace-and-earrings set gives you two ways to get dressed.",
      ideas: [
        "Wear the full set with a saree or a simple suit for a coordinated look.",
        "Wear the necklace alone with a plain neckline when you want less detail.",
        "Pair the earrings with a solid-colour top and skip other statement jewelry."
      ],
      pairingNote: "Both pieces work together for an occasion. You can also wear the necklace and earrings separately.",
      care: jewelryCare
    }
  }

  if (/\b(?:bangles?|bracelets?|cuffs?|wristwear)\b/.test(source)) {
    return {
      categoryKind: "wristwear",
      heading: "How to Style",
      intro: "A bracelet or bangle brings detail to your wrist.",
      ideas: [
        "Wear it alone with a shirt or kurta to keep your outfit simple.",
        "Pair it with a saree or suit for an occasion.",
        "If you add a watch, leave enough room so the pieces do not rub together."
      ],
      care: jewelryCare
    }
  }

  if (/\brings?\b/.test(source)) {
    return {
      categoryKind: "ring",
      heading: "How to Style",
      intro: "Let a ring be the small detail you notice.",
      ideas: [
        "Wear one ring with denim or a plain kurta for an everyday outfit.",
        "Pair it with an occasion outfit without matching every accessory.",
        "If you wear several rings, keep a little space between them."
      ],
      care: jewelryCare
    }
  }

  if (hasEarrings) {
    return {
      categoryKind: "earrings",
      heading: "How to Style",
      intro: "Choose an outfit that leaves the earrings in view.",
      ideas: [
        "Try them with a solid-colour top or a simple kurta.",
        "For an occasion, pair them with a saree or suit.",
        "Keep other jewelry minimal if the earrings are your focus."
      ],
      care: jewelryCare
    }
  }

  if (hasNecklace) {
    return {
      categoryKind: "necklace",
      heading: "How to Style",
      intro: "Start with the neckline and keep the rest of the outfit easy.",
      ideas: [
        "Wear the necklace with a plain top or open-collar shirt.",
        "Try it with a saree or suit that leaves the neckline visible.",
        "If you prefer layers, add a plain chain only when the lengths sit comfortably."
      ],
      care: jewelryCare
    }
  }

  // Gift-only and unfamiliar categories have no verified jewelry contents.
  return {
    categoryKind: "gift",
    heading: "Gift ideas",
    intro: "A small presentation detail can make a gift easier to give.",
    ideas: [
      "Add a short handwritten note about the occasion.",
      "Choose wrapping suited to the person receiving it.",
      "If it is part of a hamper, check the contents before pairing it with other gifts."
    ],
    care: giftCare
  }
}
