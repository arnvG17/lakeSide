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
          angle={0}
          noise={0.12}
          blindCount={16}
          blindMinWidth={60}
          mouseDampening={0.8}
          mirrorGradient={false}
          spotlightRadius={0.8}
          spotlightSoftness={1.3}
          spotlightOpacity={0.8}
          distortAmount={0}
          shineDirection="left"
        />
      </div>

      {/* Header */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-7xl z-50">
        <div className="bg-white/[0.03] border border-white/10 rounded-full px-4 py-2 sm:px-8 sm:py-3 backdrop-blur-md flex items-center justify-between shadow-2xl shadow-black/50">
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group">
            <div className="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-white text-black rounded-sm transform rotate-45 group-hover:rotate-90 transition-all duration-500">
              <span className="transform -rotate-45 font-bold text-xs sm:text-base">L</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tighter">LAKESIDE</h1>
          </Link>

          <nav className="hidden md:flex items-center gap-12 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
            <Link href="#" className="hover:text-white transition-colors">
              Case studies
            </Link>
            <Link href="#" className="hover:text-white transition-colors">
              About
            </Link>
          </nav>

          <Link
            href="/login"
            className="flex items-center gap-1.5 sm:gap-2 pl-4 pr-1.5 py-1.5 sm:pl-6 sm:pr-2 sm:py-2 bg-white text-black rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-white/90 transition-all group"
          >
            <span className="hidden sm:inline">Let&apos;s talk</span>
            <span className="sm:hidden">Start</span>
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-black text-white flex items-center justify-center group-hover:translate-x-0.5 transition-transform duration-300">
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </div>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col justify-start px-4 sm:px-8 relative z-10 pt-28 sm:pt-40 md:pt-48 pb-16 sm:pb-32">
        <div className="max-w-7xl mx-auto w-full">
          {/* Main Headline */}
          <div className="space-y-10 sm:space-y-20">
            <h2 className="text-3xl sm:text-6xl md:text-8xl lg:text-[110px] font-normal leading-[0.9] sm:leading-[0.85] tracking-[-0.04em] sm:tracking-[-0.06em] max-w-6xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
              The definitive AI growth partner for <span className="text-white/40">fast-moving</span> B2B companies.
            </h2>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 sm:gap-4 pl-6 sm:pl-10 pr-2 sm:pr-3 py-2 sm:py-3 bg-white text-black rounded-full text-base sm:text-xl font-black hover:bg-white/90 transition-all group shadow-2xl shadow-white/10 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200"
            >
              Let&apos;s talk
              <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full bg-black text-white flex items-center justify-center group-hover:translate-x-1 transition-transform duration-300">
                <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer / Info */}
      <footer className="px-4 sm:px-8 py-8 sm:py-12 relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-12">
          <div className="space-y-4">
            <p className="text-[10px] text-white/30 font-black tracking-[0.4em] uppercase">
              Monochrome Precision
            </p>
            <p className="text-white/50 max-w-sm text-sm leading-relaxed font-medium">
              Engineering the ultimate teaching experience through brutalist elegance and high-performance real-time systems.
            </p>
          </div>

          <div className="flex gap-12 text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">
            <span>© 2024 Lakeside</span>
            <span>Privacy</span>
            <span>Terms</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
