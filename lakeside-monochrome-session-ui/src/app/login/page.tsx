"use client"

import Link from "next/link"
import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  // -------------------------
  // EMAIL + PASSWORD LOGIN
  // -------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      alert(error.message)
      setIsLoading(false)
    } else {
      window.location.href = "/dashboard"
    }
  }

  // -------------------------
  // GOOGLE OAUTH LOGIN
  // -------------------------
  async function loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) alert(error.message)

  }

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <h1 className="text-2xl font-light tracking-[0.2em] text-white cursor-pointer hover:text-white/80 transition-colors duration-300">
              LAKESIDE
            </h1>
          </Link>
          <Link
            href="/"
            className="px-6 py-2 bg-transparent text-white text-sm font-medium tracking-wide rounded-full border border-white/20 hover:bg-white/5 transition-all duration-300"
          >
            Back to Home
          </Link>
        </div>
      </header>

      {/* Login Form Section with Noise + Gradient */}
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

        <div className="max-w-md w-full relative z-10">
          {/* Login Card */}
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-12 backdrop-blur-sm">
            {/* Header */}
            <div className="text-center space-y-2 mb-10">
              <div className="inline-block px-4 py-1.5 bg-white/5 border border-white/10 rounded-full mb-4">
                <span className="text-xs font-medium tracking-widest text-white/60">
                  SESSION STUDIO
                </span>
              </div>
              <h2 className="text-3xl font-light tracking-tight">
                Welcome Back
              </h2>
              <p className="text-sm text-white/40 font-light">
                Sign in to access your session room
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium tracking-wide text-white/60">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/[0.07] transition-all duration-300"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium tracking-wide text-white/60">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="off"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 focus:bg-white/[0.07] transition-all duration-300"
                />
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 bg-white/5 border border-white/10 rounded cursor-pointer accent-white"
                  />
                  <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors duration-300">
                    Remember me
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group w-full px-8 py-4 bg-white text-black text-sm font-medium tracking-wide rounded-full hover:bg-white/90 transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_32px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-black text-white/40 tracking-widest">
                  OR CONTINUE WITH
                </span>
              </div>
            </div>

            {/* Google Login */}
            <div className="text-center">
              <button
                onClick={loginWithGoogle}
                className="w-full px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full transition-all duration-300"
              >
                Sign in with Google
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-black text-white/40 tracking-widest">
                  NEW USER?
                </span>
              </div>
            </div>

            {/* Register Link */}
            <div className="text-center">
              <p className="text-sm text-white/40">
                Don't have an account?{" "}
                <Link
                  href="/register"
                  className="text-white font-medium hover:text-white/80 transition-colors duration-300"
                >
                  Create Account
                </Link>
              </p>
            </div>
          </div>

          {/* Footer Note */}
          <p className="text-center text-xs text-white/30 font-light mt-8 tracking-wide">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
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
