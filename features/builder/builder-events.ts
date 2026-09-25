export const BUILDER_OPEN_EVENT = "celebration:builder-open"

export type BuilderOpenDetail = {
  step: number
}

export function requestBuilderOpen(step = 1) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<BuilderOpenDetail>(BUILDER_OPEN_EVENT, {
    detail: { step: Math.min(4, Math.max(1, step)) }
  }))
}
