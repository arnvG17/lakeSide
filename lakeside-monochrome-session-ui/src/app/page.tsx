"use client"

import Link from "next/link"
import { ArrowRight, Video, Users, Gauge } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-light tracking-[0.2em] text-white">
            LAKESIDE
          </h1>
          <Link
            href="/session"
            className="px-6 py-2 bg-white text-black text-sm font-medium tracking-wide rounded-full hover:bg-white/90 transition-all duration-300"
          >
            Launch Session
          </Link>
        </div>
      </header>

      {/* Hero Section with Noise + Gradient */}
      <main className="flex-1 flex items-center justify-center px-8 py-20 relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-black to-black" />

        {/* Noise Texture Overlay */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
            backgroundSize: '128px 128px'
          }}
        />

        <div className="max-w-7xl mx-auto w-full relative z-10">
          <div className="text-center space-y-8">
            {/* Main Headline */}
            <div className="space-y-4">
              <div className="inline-block px-4 py-1.5 bg-white/5 border border-white/10 rounded-full mb-4">
                <span className="text-xs font-medium tracking-widest text-white/60">
                  PREMIUM SESSION STUDIO
                </span>
              </div>
              <h2 className="text-7xl font-light tracking-tight leading-[1.1]">
                The Figma for
                <br />
                <span className="text-white/40">Teaching</span>
              </h2>
            </div>

            {/* Description */}
            <p className="text-xl text-white/40 font-light max-w-2xl mx-auto leading-relaxed">
              Brutally elegant, monochrome precision. Every pixel engineered for
              the ultimate teaching experience.
            </p>

            {/* CTA */}
            <div className="flex items-center justify-center gap-4 pt-8">
              <Link
                href="/login"
                className="group px-8 py-4 bg-white text-black text-sm font-medium tracking-wide rounded-full hover:bg-white/90 transition-all duration-300 flex items-center gap-2 shadow-[0_0_32px_rgba(255,255,255,0.1)]"
              >
                Get Started
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
              <button className="px-8 py-4 bg-transparent text-white text-sm font-medium tracking-wide rounded-full border border-white/20 hover:bg-white/5 transition-all duration-300">
                Watch Demo
              </button>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-3 gap-[1px] max-w-4xl mx-auto pt-20 bg-white/10">
              {[
                {
                  icon: Video,
                  title: "HD Sessions",
                  description: "Crystal clear video with precision borders",
                },
                {
                  icon: Users,
                  title: "Real-time Collab",
                  description: "Whiteboard, polls, chat in monochrome glory",
                },
                {
                  icon: Gauge,
                  title: "Studio Grade",
                  description: "Leica-inspired UI with Apple-level polish",
                },
              ].map((feature, idx) => (
                <div
                  key={idx}
                  className="bg-black p-8 space-y-4 hover:bg-white/[0.02] transition-all duration-500 group"
                >
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all duration-300">
                    <feature.icon className="w-5 h-5 text-white/60" />
                  </div>
                  <h3 className="text-lg font-medium tracking-wide">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-white/40 font-light leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-white/40">
          <p className="font-light tracking-wide">
            © 2024 LAKESIDE. Brutally elegant.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors duration-300">
              Documentation
            </a>
            <a href="#" className="hover:text-white transition-colors duration-300">
              Support
            </a>
            <a href="#" className="hover:text-white transition-colors duration-300">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}