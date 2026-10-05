import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

export const metadata: Metadata = {
  title: "SyncOdonto",
  description: "Sistema de gestão para clínicas odontológicas",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "SyncOdonto", statusBarStyle: "default" },
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg",
      },
    ],
    apple: "/icon.png",
  },
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0d9488" }

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" translate="no" className="notranslate" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
      </head>
      <body className="font-sans antialiased notranslate" suppressHydrationWarning>
        {children}
        <Analytics />
</body>
    </html>
  )
}
