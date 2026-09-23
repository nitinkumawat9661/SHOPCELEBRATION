import { adminOrdersConfig, type AdminOrderFilterId } from "../../config/admin-orders"
import { productById } from "../../lib/domain/catalog"
import type { AdminOrder } from "./types"

export type AdminOrderSort = "newest" | "requiredDate"

export const adminOrderFilters = adminOrdersConfig.filters
export const defaultAdminOrderFilter = adminOrdersConfig.defaultFilter

function searchableText(order: AdminOrder) {
  const productNames = order.selectedProductNames?.length ? order.selectedProductNames : order.selectedProductIds.map((id) => productById(id)?.name || id)
  return [
    order.publicId,
    order.customerName,
    order.phone,
    order.receiverName,
    order.paymentReference,
    order.tierName,
    order.requiredDate,
    order.address,
    order.city,
    order.state,
    order.pincode,
    order.shippingProvider || "",
    order.shippingTrackingNumber || "",
    order.issueType || "",
    ...productNames
  ].join(" ").toLowerCase()
}

export function matchesAdminFilter(order: AdminOrder, filterId: AdminOrderFilterId) {
  const definition = adminOrderFilters.find((item) => item.id === filterId)
  if (!definition || definition.statuses.length === 0) return true
  return definition.statuses.includes(order.status)
}

export function matchesAdminSearch(order: AdminOrder, search: string) {
  const query = search.trim().toLowerCase()
  return !query || searchableText(order).includes(query)
}

export function filterAdminOrders(orders: AdminOrder[], filterId: AdminOrderFilterId, search: string, sort: AdminOrderSort) {
  const filtered = orders.filter((order) => matchesAdminFilter(order, filterId) && matchesAdminSearch(order, search))
  return [...filtered].sort((a, b) => {
    if (sort === "requiredDate") {
      const dateDifference = a.requiredDate.localeCompare(b.requiredDate)
      if (dateDifference !== 0) return dateDifference
    }
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function countAdminFilter(orders: AdminOrder[], filterId: AdminOrderFilterId) {
  return orders.filter((order) => matchesAdminFilter(order, filterId)).length
}
