"use client"

import type { AdminOrderFilterId } from "../../config/admin-orders"
import { uiContent } from "../../lib/domain/content"
import { adminOrderFilters, type AdminOrderSort } from "./orderFilters"

export function AdminOrderToolbar({
  search,
  filter,
  sort,
  total,
  visible,
  counts,
  onSearch,
  onFilter,
  onSort
}: {
  search: string
  filter: AdminOrderFilterId
  sort: AdminOrderSort
  total: number
  visible: number
  counts: Record<AdminOrderFilterId, number>
  onSearch: (value: string) => void
  onFilter: (value: AdminOrderFilterId) => void
  onSort: (value: AdminOrderSort) => void
}) {
  const copy = uiContent.admin
  return (
    <section className="adminToolbar" aria-label={copy.orderTools}>
      <div className="adminSearchRow">
        <label className="adminSearch">
          <span>{copy.searchLabel}</span>
          <input
            className="control"
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </label>
        <label className="adminSort">
          <span>{copy.sortLabel}</span>
          <select className="control" value={sort} onChange={(event) => onSort(event.target.value as AdminOrderSort)}>
            <option value="newest">{copy.sortNewest}</option>
            <option value="requiredDate">{copy.sortRequiredDate}</option>
          </select>
        </label>
      </div>
      <div className="adminFilterRow" role="tablist" aria-label={copy.filterLabel}>
        {adminOrderFilters.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`adminFilterChip${filter === item.id ? " active" : ""}`}
            onClick={() => onFilter(item.id)}
            role="tab"
            aria-selected={filter === item.id}
          >
            <span>{copy.filterLabels[item.id]}</span>
            <b>{counts[item.id]}</b>
          </button>
        ))}
      </div>
      <div className="adminResultCount">{copy.showingOrders.replace("{visible}", String(visible)).replace("{total}", String(total))}</div>
    </section>
  )
}
