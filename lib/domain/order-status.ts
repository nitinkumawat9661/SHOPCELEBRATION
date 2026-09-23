import workflow from "../../config/order-workflow.json"
import labels from "../../content/status.json"

export type OrderStatus =
  | "payment_verification_pending"
  | "payment_verified"
  | "preparing"
  | "packing_video_ready"
  | "customer_approved"
  | "shipped"
  | "delivered"
  | "issue_reported"
  | "refund_or_replacement_resolved"
  | "cancelled"

type Capability = keyof typeof workflow.capabilities
export type WorkflowAction = keyof typeof workflow.actions

export const ORDER_STATUSES = workflow.statuses as OrderStatus[]
export const orderStatusLabels = labels as Record<OrderStatus, string>
const transitions = workflow.transitions as Record<OrderStatus, OrderStatus[]>
export const customerTimeline = workflow.customerTimeline as OrderStatus[]
const paymentStatusByOrderStatus = workflow.paymentStatusByOrderStatus as Partial<Record<OrderStatus, string>>
const capabilities = workflow.capabilities as Record<Capability, OrderStatus[]>
const actionTargets = workflow.actions as Record<WorkflowAction, OrderStatus>
const adminTransitionTargets = new Set(workflow.adminTransitionTargets as OrderStatus[])

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus)
}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return transitions[from]?.includes(to) || false
}

export function allowedTransitions(from: OrderStatus) {
  return transitions[from] || []
}

export function adminAllowedTransitions(from: OrderStatus) {
  return allowedTransitions(from).filter((status) => adminTransitionTargets.has(status))
}

export function canAdminTransition(from: OrderStatus, to: OrderStatus) {
  return adminTransitionTargets.has(to) && canTransition(from, to)
}

export function paymentStatusForOrderStatus(status: OrderStatus, current: string) {
  return paymentStatusByOrderStatus[status] || current
}

export function statusHasCapability(status: OrderStatus, capability: Capability) {
  return capabilities[capability]?.includes(status) || false
}

export function workflowActionTarget(action: WorkflowAction) {
  return actionTargets[action]
}
