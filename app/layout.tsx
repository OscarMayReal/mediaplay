import { Geist, Geist_Mono, Figtree } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils";
import AppHeader from "@/components/header";
import { SetupDialog } from "@/components/setup";
import { MediaPlayerProvider } from "@/components/mediaPlayerContext";
import type { Metadata } from "next";

const figtree = Figtree({subsets:['latin'],variable:'--font-sans'})

export const metadata: Metadata = {
  icons: {icon: "/icon.svg"},
}

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", figtree.variable)}
    >
      <body className="flex flex-col top-0 left-0 fixed w-[100dvw] h-[100dvh]">
        <MediaPlayerProvider>
          <ThemeProvider>
            <AppHeader />
            {children}
          </ThemeProvider>
          <SetupDialog />
        </MediaPlayerProvider>
      </body>
    </html>
  )
}
