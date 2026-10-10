import type { GiftProduct } from "./catalog"

/**
 * Category-led styling copy. Never infer a metal, finish, stone, size or
 * other physical attribute from a potentially inaccurate product title.
 */
export type ProductStylingAdvice = {
  intro: string
  ideas: readonly string[]
  care: readonly string[]
  pairingNote?: string
  heading: string
}

const jewelryCare = [
  "Put on jewelry after perfume, sanitizer and lotion have dried.",
  "Take it off before sleeping, showering or swimming.",
  "Wipe gently with a soft, dry cloth and store it in a dry place."
] as const

export function stylingAdviceForProduct(product: Pick<GiftProduct, "category" | "name">): ProductStylingAdvice {
  const category = product.category.toLowerCase()
  const name = product.name.toLowerCase()

  // Prefer the verified catalog category; title wording is a fallback only.
  const source = category || name
  const hasNecklace = /\bnecklaces?\b/.test(source)
  const hasEarrings = /\bearrings?\b/.test(source)
  const isSet = hasNecklace && hasEarrings

  if (isSet) {
    return {
      heading: "How to Style",
      intro: "A matching set can make getting ready a little easier.",
      ideas: [
        "Wear both pieces with a saree or suit for a put-together look.",
        "Pair the necklace with a simple neckline for a lighter everyday outfit.",
        "Wear the earrings on their own when you want to keep the rest minimal."
      ],
      pairingNote: "Wear the necklace and earrings together for a coordinated look. You can style them separately, too.",
      care: jewelryCare
    }
  }

  if (/\b(?:bangles?|bracelets?|cuffs?)\b/.test(source)) {
    return {
      heading: "How to Style",
      intro: "An easy finishing touch for your wrist.",
      ideas: [
        "Wear it on its own with a shirt or kurta for a clean everyday look.",
        "Pair it with a saree or suit when you want a little more detail.",
        "Keep other wrist accessories simple so the piece stands out."
      ],
      care: jewelryCare
    }
  }

  if (/\brings?\b/.test(source)) {
    return {
      heading: "How to Style",
      intro: "Small details can make an outfit feel more like you.",
      ideas: [
        "Wear the ring alone for a simple, everyday look.",
        "Try it with a kurta, denim or an occasion outfit.",
        "If you stack rings, leave a little space so each design is visible."
      ],
      care: jewelryCare
    }
  }

  if (hasEarrings || /\b(?:studs?|hoops?)\b/.test(source)) {
    return {
      heading: "How to Style",
      intro: "An easy way to add interest without changing your whole outfit.",
      ideas: [
        "Pair the earrings with a simple top for everyday wear.",
        "Try them with a saree or suit for a dressier look.",
        "Keep your necklace minimal if you want the earrings to stand out."
      ],
      care: jewelryCare
    }
  }

  if (hasNecklace || /\b(?:pendants?|lockets?)\b/.test(source)) {
    return {
      heading: "How to Style",
      intro: "A necklace you can work into more than one kind of outfit.",
      ideas: [
        "Wear it with a simple top or shirt for an easy everyday touch.",
        "Try it with a saree or suit when you want the neckline to stand out.",
        "For a party or casual gathering, layer it with a plain chain if you like a fuller look."
      ],
      care: jewelryCare
    }
  }

  // Gift-only catalog items should not receive invented jewelry advice.
  return {
    heading: "How to Style",
    intro: "A few simple ways to make this gift feel more personal.",
    ideas: [
      "Pair it with a handwritten note for a personal touch.",
      "Choose wrapping that fits the occasion and the person receiving it.",
      "Add it to a hamper with other items they will enjoy."
    ],
    care: [
      "Check the product details for any item-specific care instructions.",
      "Keep the gift clean and dry until it is ready to give."
    ]
  }
}
