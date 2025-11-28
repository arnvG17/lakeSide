"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

export default function AuthCodeError() {
    const searchParams = useSearchParams()
    const error = searchParams.get("error")
    const error_description = searchParams.get("error_description")

    return (
        <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center px-8">
            <div className="max-w-md w-full text-center space-y-6">
                <h1 className="text-3xl font-light tracking-tight text-red-500">
                    Authentication Error
                </h1>
                <p className="text-white/60">
                    There was a problem signing you in.
                </p>
                {(error || error_description) && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-200">
                        <p className="font-bold">{error}</p>
                        <p>{error_description}</p>
                    </div>
                )}
                <Link
                    href="/login"
                    className="inline-block px-8 py-3 bg-white text-black text-sm font-medium tracking-wide rounded-full hover:bg-white/90 transition-all duration-300"
                >
                    Back to Login
                </Link>
            </div>
        </div>
    )
}
