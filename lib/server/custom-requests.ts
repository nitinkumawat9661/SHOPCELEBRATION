import type { NormalizedCustomHamperRequest } from "../domain/custom-request"
import { query } from "./db"

export type CustomHamperRequestRecord = {
  id: string
  customerName: string
  phone: string
  budgetPaise: number
  requestText: string
  status: "new" | "contacted" | "closed"
  createdAt: string
  updatedAt: string
}

type Row = {
  id: string
  customer_name: string
  phone: string
  budget_paise: number
  request_text: string
  status: "new" | "contacted" | "closed"
  created_at: Date
  updated_at: Date
}

function mapRow(row: Row): CustomHamperRequestRecord {
  return {
    id: row.id,
    customerName: row.customer_name,
    phone: row.phone,
    budgetPaise: row.budget_paise,
    requestText: row.request_text,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }
}

export async function createCustomHamperRequest(input: NormalizedCustomHamperRequest) {
  const id = crypto.randomUUID()
  const result = await query<Row>(
    `INSERT INTO custom_hamper_requests (id, customer_name, phone, budget_paise, request_text)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, input.customerName, input.phone, input.budgetPaise, input.message]
  )
  return mapRow(result.rows[0])
}

export async function listCustomHamperRequests() {
  const result = await query<Row>(
    `SELECT * FROM custom_hamper_requests
     ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'contacted' THEN 1 ELSE 2 END, created_at DESC
     LIMIT 300`
  )
  return result.rows.map(mapRow)
}

export async function updateCustomHamperRequestStatus(id: string, status: CustomHamperRequestRecord["status"]) {
  const result = await query<Row>(
    `UPDATE custom_hamper_requests
     SET status = $2, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, status]
  )
  return result.rows[0] ? mapRow(result.rows[0]) : null
}
