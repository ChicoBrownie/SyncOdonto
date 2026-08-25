import type React from "react"
import type { Metadata } from "next"
import { Geist } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "SyncOdonto",
  description: "Sistema de gestão para clínicas odontológicas",
  icons: {
    icon: [
      {
        url: "/icon.svg",
        type: "image/svg",
      },
    ],
    apple: "/apple-icon.svg",
  },
}

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
      <body className={`${geist.className} font-sans antialiased notranslate`} suppressHydrationWarning>
        {children}
        <Analytics />
</body>
    </html>
  )
}
