import { Instrument_Serif, Inter, JetBrains_Mono, Newsreader } from "next/font/google"
import { EmberLanding } from "@/components/ember-landing"
import "../ember.css"

const sans = Inter({ subsets: ["latin"], variable: "--font-ember-sans", adjustFontFallback: false })
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-ember-serif",
  adjustFontFallback: false,
})
const news = Newsreader({ subsets: ["latin"], variable: "--font-ember-news", adjustFontFallback: false })
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-ember-mono", adjustFontFallback: false })

export default function LandingPage() {
  return (
    <div className={`${sans.variable} ${serif.variable} ${news.variable} ${mono.variable}`}>
      <EmberLanding />
    </div>
  )
}
