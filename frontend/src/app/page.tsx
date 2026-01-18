"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { ShaderBackground } from "@/components/ui/hero-shader"
import { PixelTrail } from "@/components/ui/pixel-trail"
import { useScreenSize } from "@/components/hooks/use-screen-size"
import { motion } from "framer-motion"

export default function Home() {
  const screenSize = useScreenSize()

  return (
    <ShaderBackground>
      {/* Pixel Trail Cursor Effect */}
      <div className="absolute inset-0 z-10">
        <PixelTrail
          pixelSize={screenSize.lessThan("md") ? 48 : 64}
          fadeDuration={0}
          delay={800}
          pixelClassName="rounded-full bg-orange-500/40"
        />
      </div>
      {/* Floating Navbar */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl" style={{ fontFamily: 'Supreme, sans-serif' }}>
        <div className="flex md:grid md:grid-cols-[1fr_auto_1fr] items-center justify-between px-6 py-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg shadow-black/10 transition-all duration-300 hover:bg-white/15">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group justify-self-start">
            <span className="text-3xl font-bold tracking-tighter text-black">Lakeside</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-1 justify-self-center">
            {["Features", "Pricing", "Docs"].map((item) => (
              <Link
                key={item}
                href="#"
                className="text-black/70 hover:text-black text-sm font-medium px-5 py-2 rounded-full hover:bg-white/5 transition-all duration-200"
              >
                {item}
              </Link>
            ))}
          </nav>

          {/* Login Button Group */}
          <div id="gooey-btn" className="relative flex items-center group justify-self-end" style={{ filter: "url(#gooey-filter)" }}>
            <Link
              href="/login"
              className="absolute right-0 px-3 py-2.5 rounded-full bg-black text-white font-medium text-sm transition-all duration-300 hover:bg-white/90 cursor-pointer h-10 flex items-center justify-center -translate-x-10 group-hover:-translate-x-20 z-0"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-2.5 rounded-full bg-black text-white font-medium text-sm transition-all duration-300 hover:bg-white/90 cursor-pointer h-10 flex items-center z-10"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Content */}
      <main className="absolute bottom-12 left-8 sm:bottom-24 sm:left-20 z-20 max-w-4xl" style={{ fontFamily: 'Supreme, sans-serif' }}>
        <div className="text-left">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            className="inline-flex items-center px-5 py-2 rounded-full bg-white/5 backdrop-blur-md mb-8 border border-white/10 shadow-lg shadow-black/20"
          >

          </motion.div>

          {/* Main Heading */}
          <motion.h1
            initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
            className="text-5xl sm:text-6xl md:text-7xl font-medium leading-[0.9] tracking-tight text-black mb-8"
          >
            The ultimate studio
            <br />
            <span className="text-[#ea580c]">for creators.</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.6 }}
            className="text-lg sm:text-xl text-black/50 mb-10 leading-relaxed max-w-2xl font-light"
          >
            Professional-grade recording with local-first quality,
            real-time transcription, and seamless collaboration.
          </motion.p>

          {/* Buttons */}
          <motion.div
            initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.8 }}
            className="flex items-center gap-6 flex-wrap"
          >
            <Link
              href="/login"
              className="px-10 py-5 rounded-full bg-black text-white font-semibold text-base transition-all duration-300 hover:bg-[#ea580c] hover:text-white inline-flex items-center gap-3 shadow-xl shadow-black/20 hover:scale-105"
            >

              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#"
              className="px-10 py-5 rounded-full bg-white/5 border border-white/10 text-white font-medium text-base transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:scale-105"
            >
              Learn More
            </Link>
          </motion.div>
        </div>
      </main>
    </ShaderBackground>
  )
}
