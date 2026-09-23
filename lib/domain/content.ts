import store from "../../content/store.json"
import ui from "../../content/ui.json"
import errors from "../../content/errors.json"

const customerUi = {
  nav: {
    ...ui.nav,
    budgets: "Budgets",
    products: "Gift options",
    builder: "Build your hamper",
    promise: "Why Celebration",
    create: "Create hamper",
    backToStore: "← Back to store"
  },
  hero: {
    ...ui.hero,
    primary: "Build your hamper →",
    secondaryPrefix: "Starting at",
    stats: ["Your budget", "Their favourites", "Made personal"],
    showcaseSubline: "Thoughtful • Personal • Made for them",
    customFeelValue: "Personal"
  },
  budgets: {
    ...ui.budgets,
    kicker: "CHOOSE YOUR BUDGET",
    title: "Pick a budget that feels right.",
    body: "Every price is the complete hamper budget — not just the box. Choose one and we’ll show what fits beautifully inside.",
    choices: "items",
    points: "mix limit"
  },
  products: {
    ...ui.products,
    kicker: "PICK WHAT THEY’LL LOVE",
    title: "Make it feel like them.",
    body: "Choose from the gifts available in your budget. If something needs a higher budget, we’ll show that clearly.",
    from: "From"
  },
  builder: {
    ...ui.builder,
    kicker: "BUILD YOUR HAMPER",
    title: "Four clear steps. One personal gift.",
    body: "Choose a budget, pick the gifts, add delivery details and pay. We’ll take care of the presentation.",
    stepLabels: ["1. Budget", "2. Gifts", "3. Delivery", "4. Payment"],
    budget: {
      ...ui.builder.budget,
      title: "1. Choose your budget",
      body: "Start with the amount you want to spend. We’ll keep the available gift options within that budget.",
      next: "Choose gifts →"
    },
    products: {
      ...ui.builder.products,
      title: "2. Pick what they’ll love",
      search: "Search gifts",
      back: "← Back",
      next: "Add delivery details →",
      selectedSuffix: "selected",
      choicesLabel: "items",
      mixPointsLabel: "mix limit",
      availableFrom: "Available from {amount}",
      maxChoices: "Up to {count} items",
      mixExceedsBudget: "This combination goes above the selected budget"
    },
    details: {
      ...ui.builder.details,
      title: "3. Where should we send it?",
      body: "Add the delivery details and the date you need it by.",
      fields: {
        customerName: ["Your name *", "Full name"],
        phone: ["Mobile / WhatsApp *", "10-digit number"],
        receiverName: ["Gift for *", "Receiver name"],
        requiredDate: ["Needed by *", ""],
        occasion: ["Occasion", ""],
        pincode: ["Pincode *", "6 digits"],
        address: ["Delivery address *", "House / street / area"],
        city: ["City", "City"],
        state: ["State", "State"],
        message: ["Gift message", "What should we write on the message card?"]
      },
      back: "← Back",
      nextHint: "Next: secure payment",
      next: "Continue to payment →"
    },
    summary: {
      ...ui.builder.summary,
      kicker: "YOUR HAMPER",
      hamper: "Hamper",
      box: "Size",
      occasion: "Occasion",
      products: "Selected gifts",
      requiredBy: "Needed by",
      notSet: "Not added",
      curate: "Choose for me",
      note: "If a major item needs to change because of stock or presentation, we’ll confirm it with you first."
    },
    payment: {
      ...ui.builder.payment,
      title: "4. Secure payment",
      body: "Pay via UPI, add the transaction reference and place your order.",
      payable: "TOTAL TO PAY",
      payButton: "Pay with UPI",
      setupButton: "Payment setup pending",
      referenceLabel: "UPI UTR / Transaction Reference *",
      referencePlaceholder: "Enter transaction reference",
      back: "← Back",
      hint: "Packing video before dispatch",
      submit: "Place order",
      submitting: "Placing order…",
      successPrefix: "Order confirmed:",
      successBody: "Your order is in. You can follow every update from My Celebration.",
      trackingButton: "Track order",
      whatsappButton: "WhatsApp support"
    }
  },
  promise: {
    ...ui.promise,
    kicker: "WHY CELEBRATION",
    title: "More confidence at every step.",
    body: "Clear pricing, a packing video before dispatch, order tracking and support when you need it."
  },
  cta: {
    ...ui.cta,
    title: "Ready to make someone smile?",
    body: "Pick a budget and a few things they’ll love. We’ll turn it into a hamper that feels made for them.",
    button: "Build my hamper"
  },
  footer: {
    ...ui.footer,
    policy: "Order & Protection Policy"
  },
  tracking: {
    ...ui.tracking,
    title: "Track your Celebration order",
    loading: "Loading your order…",
    invalid: "This tracking link is invalid or has expired.",
    lookupTitle: "Find your order",
    lookupBody: "Enter your Order ID and the requested phone digits to open tracking.",
    lookupOrderId: "Order ID",
    lookupPhonePrefix: "Last",
    lookupPhoneSuffix: "phone digits",
    lookupButton: "Open tracking",
    lookupBusy: "Finding your order…",
    lookupValidation: "Enter the Order ID and required phone digits.",
    lookupFailed: "We couldn’t match those details. Check the Order ID and phone digits and try again.",
    lookupPrivacy: "Only the required phone digits are used here.",
    requiredBy: "Needed by",
    packingVideo: "Packing video",
    approve: "Approve for dispatch",
    approved: "Packing approved for dispatch.",
    notAvailable: "Not available yet",
    approvalTitle: "Review the packing before dispatch",
    approvalBody: "Watch the video, check the hamper, then approve it for dispatch.",
    approvalConsent: "I’ve reviewed the packing video and approve this hamper for dispatch.",
    approvalNote: "After approval, shipping and tracking details will appear here.",
    approvalBusy: "Approving…",
    approvalWaitingTitle: "Packing video is being prepared",
    approvalWaitingBody: "The approval button will appear here when the packing video is ready.",
    approvalUnavailableTitle: "Approval isn’t available yet",
    approvalUnavailableBody: "You’ll be able to approve once the packing video is ready.",
    approvedTitle: "Approved for dispatch",
    approvedBody: "Your approval is saved. The order can now move to shipping."
  }
}

export const storeContent = store
export const uiContent = { ...ui, ...customerUi }
export const errorMessages = errors as Record<string, string>
