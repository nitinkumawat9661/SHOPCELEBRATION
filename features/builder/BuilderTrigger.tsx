"use client"

import type { ButtonHTMLAttributes, ReactNode } from "react"
import { requestBuilderOpen } from "./builder-events"

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  step?: number
  children: ReactNode
}

export function BuilderTrigger({ step = 1, children, ...props }: Props) {
  return <button {...props} type={props.type || "button"} onClick={() => requestBuilderOpen(step)}>{children}</button>
}
