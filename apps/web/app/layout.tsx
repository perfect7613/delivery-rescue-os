import type { Metadata } from "next"
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import "./globals.css"

const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans" })
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Delivery Rescue",
  description: "An always-on operator for failed deliveries.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", sans.variable, serif.variable, mono.variable)}>
      <body className="antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
