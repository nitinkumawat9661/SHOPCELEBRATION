import type { Metadata, Viewport } from "next"
import { publicEnv } from "../config/public-env"
import { storeContent } from "../lib/domain/content"
import { UxMessenger } from "../features/ux/UxMessenger"
import "./globals.css"

export const metadata: Metadata = {
  title: storeContent.seo.title,
  description: storeContent.seo.description,
  robots: publicEnv.siteIndexable ? { index: true, follow: true } : { index: false, follow: false }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: storeContent.brand.themeColor
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<UxMessenger /></body></html>
}
