import { publicEnv } from "../../config/public-env"
import { storeContent } from "./content"

export function supportWhatsappNumber(override?: string) {
  const runtime = String(override || "").replace(/\D/g, "")
  if (runtime) return runtime
  const configured = publicEnv.whatsapp.replace(/\D/g, "")
  const fallback = String(storeContent.support.whatsapp || "").replace(/\D/g, "")
  return configured || fallback
}

export function supportWhatsappUrl(message = storeContent.support.supportMessage, overrideNumber?: string) {
  return `https://wa.me/${supportWhatsappNumber(overrideNumber)}?text=${encodeURIComponent(message)}`
}
