import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, LogOut } from 'lucide-react'
import { logout, getRecordings } from './actions'

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    // Fetch real recordings
    const { recordings } = await getRecordings()

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
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-sm font-medium text-white">{user.email}</p>
                            <p className="text-xs text-white/40">ID: {user.id.slice(0, 8)}...</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-medium">
                            {user.email?.[0].toUpperCase()}
                        </div>
                        <form action={logout}>
                            <button
                                type="submit"
                                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium tracking-wide rounded-full transition-all duration-300 flex items-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-8 py-12">
                <div className="max-w-7xl mx-auto space-y-12">
                    {/* Welcome Section */}
                    <div className="flex items-end justify-between">
                        <div>
                            <h2 className="text-4xl font-light tracking-tight mb-2">Dashboard</h2>
                            <p className="text-white/40 font-light">Manage your sessions and recordings</p>
                        </div>
                        <Link
                            href="/generate"
                            className="px-6 py-3 bg-white text-black text-sm font-medium tracking-wide rounded-full hover:bg-white/90 transition-all duration-300 flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Generate New
                        </Link>
                    </div>

                    {/* Recordings Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {recordings.map((recording) => (
                            <div
                                key={recording.id}
                                className="group bg-white/[0.02] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                                        <div className="w-3 h-3 rounded-sm bg-white/40" />
                                    </div>
                                    <span className="text-xs font-mono text-white/30">{recording.duration}</span>
                                </div>
                                <h3 className="text-lg font-light mb-1">{recording.name}</h3>
                                <p className="text-xs text-white/40">{recording.date}</p>
                            </div>
                        ))}

                        {/* Empty State Placeholder */}
                        <div className="border border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[200px] hover:border-white/20 transition-colors">
                            <p className="text-sm text-white/40 mb-4">Start a new recording session</p>
                            <Link
                                href="/generate"
                                className="text-xs font-medium text-white border-b border-white/20 pb-0.5 hover:text-white/80 hover:border-white/40 transition-all"
                            >
                                Create Session
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
