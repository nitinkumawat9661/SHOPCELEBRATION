import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { publicEnv } from "../config/public-env"
import { storeContent } from "../lib/domain/content"
import "./globals.css"

const displayFont = localFont({
  src: [
    { path: "./fonts/bodoni-moda-latin.woff2", weight: "400 700", style: "normal" },
    { path: "./fonts/bodoni-moda-italic-latin.woff2", weight: "400 700", style: "italic" }
  ],
  variable: "--font-shopping-display",
  adjustFontFallback: "Times New Roman",
  display: "swap"
})
const bodyFont = localFont({ src: "./fonts/inter-latin.woff2", weight: "400 700", variable: "--font-shopping-sans", display: "swap" })
const accentFont = localFont({ src: "./fonts/allura-latin.woff2", weight: "400", variable: "--font-shopping-script", adjustFontFallback: "Times New Roman", display: "swap" })

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
  return <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${accentFont.variable}`}><body>{children}</body></html>
}
