"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Copy, Check, RefreshCw } from "lucide-react"
import { createClient } from "@/utils/supabase/client"

export default function GenerateRoom() {
  const [roomId, setRoomId] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [roomName, setRoomName] = useState<string>("")

  // CALL THE BACKEND to create a room (secure, server-side created UUID)
  const createRoomOnServer = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      console.log(token, "token: createing room now")

      if (!token) {
        alert("Not authenticated. Please sign in first.")
        setLoading(false)
        return
      }

      const res = await fetch("http://localhost:3001/api/rooms/create", {
        method: "POST",
        body: JSON.stringify({ roomName }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })

      const json = await res.json()
      console.log(json, "json: room created")
      if (!res.ok) {
        console.error("Create room failed", json)
        alert(json.error || "Failed to create room")
        setLoading(false)
        return
      }

      // Use the canonical room id from backend
      const id = json.room?.id ?? (json.roomUrl ? new URL(json.roomUrl).pathname.split("/").pop() : null)
      if (id) setRoomId(id)

      // optionally redirect immediately:
      // window.location.href = json.roomUrl
      setLoading(false)
    } catch (err) {
      console.error(err)
      alert("Failed to create room")
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    if (!roomId) return
    const url = `${window.location.origin}/room/${roomId}` // using canonical room path
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-black to-black" />
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px'
        }}
      />

      <div className="max-w-md w-full relative z-10 space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-light tracking-tight">Start a Session</h1>
          <p className="text-white/40 font-light">Generate a unique room link to share with participants.</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-6 backdrop-blur-sm">
          {!roomId ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto">
                <RefreshCw className="w-6 h-6 text-white/40" />
              </div>
              <input type="text" placeholder="Room Name" className="w-full py-3 bg-white/5 border border-white/10 rounded-md text-white/80 font-mono" onChange={(e) => setRoomName(e.target.value)} />
              <button
                onClick={createRoomOnServer}
                className="w-full py-3 bg-white text-black text-sm font-medium tracking-wide rounded-md hover:bg-white/90 transition-all duration-300"
              >
                {loading ? "Creating..." : "Create Room"}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/40 tracking-wide uppercase">Room Link</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-black/40 border border-white/10 rounded-md px-3 py-2 text-sm text-white/80 font-mono truncate">
                    {typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : `.../room/${roomId}`}
                  </div>
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-md text-white transition-all duration-300"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <Link
                  href={`/room/${roomId}`}
                  className="w-full py-3 bg-white text-black text-sm font-medium tracking-wide rounded-md hover:bg-white/90 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  Enter Room
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <button
                onClick={() => { setRoomId(""); setCopied(false) }}
                className="w-full text-xs text-white/40 hover:text-white/60 transition-colors"
              >
                Create another
              </button>
            </div>
          )}
        </div>

        <div className="text-center">
          <Link href="/" className="text-sm text-white/40 hover:text-white transition-colors">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  )
}
