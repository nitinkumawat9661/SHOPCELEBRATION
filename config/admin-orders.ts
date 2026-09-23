import rawAdminOrders from "./admin-orders.json"
import type { OrderStatus } from "../lib/domain/order-status"

export type AdminOrderFilterId = "active" | "payment" | "packing" | "approval" | "shipping" | "issues" | "closed" | "all"

export type AdminOrderFilter = {
  id: AdminOrderFilterId
  statuses: OrderStatus[]
}

type AdminOrdersConfig = {
  defaultFilter: AdminOrderFilterId
  filters: AdminOrderFilter[]
}

export const adminOrdersConfig = rawAdminOrders as AdminOrdersConfig
