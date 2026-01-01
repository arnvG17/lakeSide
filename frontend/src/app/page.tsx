"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import GradientBlinds from "@/components/ui/GradientBlinds"

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-[#080707] text-white flex flex-col relative overflow-hidden font-stardom">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <GradientBlinds
          gradientColors={["#110d11", "#0c0b0e", "#080707"]}
          angle={45}
          noise={0.5}
          blindCount={16}
          blindMinWidth={60}
          mouseDampening={0.4}
          mirrorGradient={false}
          spotlightRadius={1.4}
          spotlightSoftness={1}
          spotlightOpacity={1}
          distortAmount={0}
          shineDirection="left"
        />
      </div>

      {/* Header */}
      <header className="px-8 py-8 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-sm transform rotate-45 group-hover:rotate-90 transition-transform duration-500">
              <span className="transform -rotate-45 font-bold">L</span>
            </div>
            <h1 className="text-xl font-bold tracking-tighter">LAKESIDE</h1>
          </Link>

          <nav className="hidden md:flex items-center gap-12">
            <Link href="#" className="text-sm font-medium text-white/50 hover:text-white transition-colors">
              Case studies
            </Link>
            <Link href="#" className="text-sm font-medium text-white/50 hover:text-white transition-colors">
              About
            </Link>
          </nav>

          <Link
            href="/login"
            className="flex items-center gap-2 px-6 py-2.5 bg-white text-black rounded-full text-sm font-bold hover:bg-white/90 transition-all group"
          >
            Let's talk
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-center px-8 relative z-10 pt-20">
        <div className="max-w-7xl mx-auto w-full">
          {/* Main Headline */}
          <div className="space-y-12">
            <h2 className="text-6xl md:text-7xl lg:text-8xl font-normal leading-[0.95] tracking-tighter max-w-5xl">
              The definitive AI growth partner for fast-moving B2B companies.
            </h2>

            <Link
              href="/login"
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-black rounded-full text-lg font-bold hover:bg-white/90 transition-all group shadow-2xl shadow-white/5"
            >
              Let's talk
              <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
                <ArrowRight className="w-4 h-4" />
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer / Info */}
      <footer className="px-8 py-12 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-8">
          <div className="space-y-2">
            <p className="text-sm text-white/30 font-medium tracking-widest uppercase">
              Monochrome Precision
            </p>
            <p className="text-white/60 max-w-sm text-sm">
              Engineering the ultimate teaching experience through brutalist elegance and high-performance real-time systems.
            </p>
          </div>

          <div className="flex gap-8 text-xs font-bold text-white/20 uppercase tracking-widest">
            <span>© 2024 Lakeside</span>
            <span>Privacy</span>
            <span>Terms</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
