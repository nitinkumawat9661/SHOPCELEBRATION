import Script from "next/script"

export function GoogleAnalytics({ measurementId }: { measurementId: string }) {
  if (!/^G-[A-Z0-9]+$/i.test(measurementId)) return null

  return <>
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
      strategy="afterInteractive"
    />
    <Script id="celebration-ga4" strategy="afterInteractive">{`
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function(){dataLayer.push(arguments);};
      gtag('js', new Date());
      gtag('config', '${measurementId}');
    `}</Script>
  </>
}
