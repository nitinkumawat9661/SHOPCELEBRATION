import type { CheckoutData } from "../../features/builder/types"

export type DeliveryAddress = Pick<CheckoutData, "receiverName" | "address" | "city" | "state" | "pincode">

export function deliveryFromCheckout(checkout: CheckoutData): DeliveryAddress {
  return { receiverName: checkout.receiverName, address: checkout.address, city: checkout.city, state: checkout.state, pincode: checkout.pincode }
}

export function deliveryHasInput(checkout: CheckoutData) {
  return Boolean(checkout.address.trim() || checkout.city.trim() || checkout.pincode.trim())
}

export function applyDelivery(checkout: CheckoutData, address: DeliveryAddress): CheckoutData {
  return { ...checkout, receiverName: checkout.receiverName.trim() || address.receiverName, address: address.address, city: address.city, state: address.state, pincode: address.pincode }
}
