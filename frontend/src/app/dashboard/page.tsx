import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, LogOut } from 'lucide-react'
import { logout, getRecordings, getPreviousMeetings } from './actions'
import { JoinMeetingButton } from '@/components/JoinMeetingButton'
import { MeetingsList } from '@/components/MeetingsList'
import Beams from '@/components/ui/Beams'

export default async function DashboardPage() {
    const supabase = await createClient()

    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return redirect('/login')
    }

    // Fetch real recordings and meetings
    const { recordings } = await getRecordings()
    const { meetings } = await getPreviousMeetings()
    console.log(meetings);

    return (
        <div className="min-h-screen w-full bg-black text-white flex flex-col relative overflow-hidden">
            {/* Background Effect */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
                <Beams
                    beamNumber={100}
                    lightColor="#0040ff"
                    speed={5}
                    rotation={-15}
                />
            </div>

            {/* Header */}
            <header className="border-b border-white/10 px-4 py-4 sm:px-8 sm:py-6 relative z-10">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link href="/">
                        <h1 className="text-2xl font-light tracking-[0.2em] text-white cursor-pointer hover:text-white/80 transition-colors duration-300">
                            LAKESIDE
                        </h1>
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-4">
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium text-white">{user.email}</p>
                            <p className="text-xs text-white/40">ID: {user.id.slice(0, 8)}...</p>
                        </div>
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-medium text-sm sm:text-base">
                            {user.email?.[0].toUpperCase()}
                        </div>
                        <form action={logout}>
                            <button
                                type="submit"
                                className="px-3 py-1.5 sm:px-4 sm:py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs sm:text-sm font-medium tracking-wide rounded-full transition-all duration-300 flex items-center gap-1.5 sm:gap-2"
                            >
                                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 py-6 sm:px-8 sm:py-12 relative z-10">
                <div className="max-w-7xl mx-auto space-y-12">
                    {/* Welcome Section */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-2xl sm:text-4xl font-light tracking-tight mb-1 sm:mb-2">Dashboard</h2>
                            <p className="text-white/40 font-light text-sm sm:text-base">Manage your sessions and recordings</p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                            <JoinMeetingButton />
                            <Link
                                href="/generate"
                                className="px-4 py-2 sm:px-6 sm:py-3 bg-white text-black text-xs sm:text-sm font-medium tracking-wide rounded-full hover:bg-white/90 transition-all duration-300 flex items-center gap-1.5 sm:gap-2"
                            >
                                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                Generate New
                            </Link>
                        </div>
                    </div>

                    {/* Previous Meetings Section */}
                    <div>
                        <h3 className="text-xl font-light tracking-wide mb-6 text-white/80">Previous Meetings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <MeetingsList meetings={meetings} recordings={recordings} />
                        </div>
                    </div>

                    {/* Recordings Section */}
                    <div>
                        <h3 className="text-xl font-light tracking-wide mb-6 text-white/80">Recordings</h3>
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
                </div>
            </main>
        </div>
    )
}
