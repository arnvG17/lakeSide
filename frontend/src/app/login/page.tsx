"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

function LoginContent() {
  const [isLoading, setIsLoading] = useState(false)
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/dashboard"
  const supabase = createClient()

  // -------------------------
  // GOOGLE OAUTH LOGIN
  // -------------------------
  async function loginWithGoogle() {
    setIsLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    })

    if (error) {
      alert(error.message)
      setIsLoading(false)
    }
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

      {/* Login Section with Noise + Gradient */}
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

            {/* Google Login Button */}
            <button
              onClick={loginWithGoogle}
              disabled={isLoading}
              className="group w-full px-8 py-4 bg-white text-black text-sm font-medium tracking-wide rounded-full hover:bg-white/90 transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_0_32px_rgba(255,255,255,0.1)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span>Signing In...</span>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                </>
              )}
            </button>

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

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  )
}
