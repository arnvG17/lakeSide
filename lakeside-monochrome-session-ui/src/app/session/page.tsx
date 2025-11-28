"use client"

import { useState } from "react"
import { Mic, MicOff, Video, VideoOff, MonitorUp, Circle, Flag, PhoneOff } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"

export default function SessionRoom() {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOff, setIsVideoOff] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [activeTab, setActiveTab] = useState("whiteboard")
  const [activeSpeaker, setActiveSpeaker] = useState<number | null>(1)
  const [showMarkerTooltip, setShowMarkerTooltip] = useState(false)

  // Mock participants
  const participants = [
    { id: 1, name: "Alex Johnson", avatar: "AJ", speaking: true },
    { id: 2, name: "Sarah Chen", avatar: "SC", speaking: false },
    { id: 3, name: "Michael Torres", avatar: "MT", speaking: false },
    { id: 4, name: "Emma Davis", avatar: "ED", speaking: false },
    { id: 5, name: "David Kim", avatar: "DK", speaking: false },
    { id: 6, name: "Lisa Anderson", avatar: "LA", speaking: false },
  ]

  const attendanceData = [
    { name: "Alex Johnson", time: 45, percentage: 90 },
    { name: "Sarah Chen", time: 42, percentage: 84 },
    { name: "Michael Torres", time: 38, percentage: 76 },
    { name: "Emma Davis", time: 35, percentage: 70 },
  ]

  return (
    <div className="h-screen w-full bg-black flex flex-col overflow-hidden">
      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute top-6 left-6 z-50 flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm border border-white/10 rounded-full">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          <span className="text-white text-xs font-medium tracking-wide">REC</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="w-full h-full grid grid-cols-3 gap-[1px] max-w-7xl">
            {participants.map((participant) => (
              <div
                key={participant.id}
                className={`relative bg-black border border-white/20 overflow-hidden group transition-all duration-500 ${
                  activeSpeaker === participant.id ? 'scale-[1.02] border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : ''
                }`}
              >
                {/* Video Placeholder */}
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-4xl font-light text-white/80 tracking-wider">
                      {participant.avatar}
                    </span>
                  </div>
                </div>

                {/* Participant Name */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white tracking-wide">
                      {participant.name}
                    </span>
                    {participant.speaking && (
                      <div className="w-1 h-1 bg-white rounded-full animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all duration-300" />
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div
          className={`transition-all duration-500 ease-in-out border-l border-white/10 ${
            isPanelOpen ? 'w-96' : 'w-0'
          } overflow-hidden`}
        >
          <div className="w-96 h-full bg-black/50 backdrop-blur-xl flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col p-6">
              <TabsList className="bg-black/40 border border-white/10 p-1">
                <TabsTrigger 
                  value="whiteboard"
                  className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60 font-medium tracking-wide text-xs"
                >
                  Whiteboard
                </TabsTrigger>
                <TabsTrigger 
                  value="attendance"
                  className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60 font-medium tracking-wide text-xs"
                >
                  Attendance
                </TabsTrigger>
                <TabsTrigger 
                  value="chat"
                  className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60 font-medium tracking-wide text-xs"
                >
                  Chat
                </TabsTrigger>
                <TabsTrigger 
                  value="polls"
                  className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60 font-medium tracking-wide text-xs"
                >
                  Polls
                </TabsTrigger>
              </TabsList>

              <TabsContent value="whiteboard" className="flex-1 mt-6">
                <div className="h-full bg-white rounded-sm border border-white/20 p-4 flex items-center justify-center">
                  <span className="text-black/40 text-sm font-medium tracking-wide">Canvas Area</span>
                </div>
              </TabsContent>

              <TabsContent value="attendance" className="flex-1 mt-6 overflow-auto">
                <div className="space-y-4">
                  {attendanceData.map((person, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium tracking-wide">{person.name}</span>
                        <span className="text-white/40 text-xs font-mono">{person.time}m</span>
                      </div>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white transition-all duration-1000"
                          style={{ width: `${person.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="chat" className="flex-1 mt-6 overflow-auto">
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="self-start max-w-[80%] bg-white/10 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2">
                      <p className="text-white text-sm font-light">Hello everyone!</p>
                    </div>
                    <div className="self-end max-w-[80%] bg-white text-black border border-white/20 rounded-lg px-3 py-2">
                      <p className="text-sm font-light">Good morning!</p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="polls" className="flex-1 mt-6 overflow-auto">
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-sm p-4 space-y-3">
                    <h4 className="text-white font-medium text-sm tracking-wide">Quick Poll</h4>
                    <p className="text-white/60 text-xs">How clear is the material?</p>
                    <div className="space-y-2">
                      {['Very Clear', 'Clear', 'Unclear'].map((option) => (
                        <button
                          key={option}
                          className="w-full bg-black/40 hover:bg-white/10 border border-white/10 rounded-sm px-3 py-2 text-white text-xs font-medium tracking-wide transition-all duration-300"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Floating Control Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-full px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center gap-3">
          {/* Mute Button */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              isMuted
                ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.3)]'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Video Button */}
          <button
            onClick={() => setIsVideoOff(!isVideoOff)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              isVideoOff
                ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.3)]'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all duration-300">
            <MonitorUp className="w-5 h-5" />
          </button>

          {/* Record Button */}
          <button
            onClick={() => setIsRecording(!isRecording)}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording
                ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.3)]'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
          >
            <Circle className={`w-5 h-5 ${isRecording ? 'fill-current' : ''}`} />
          </button>

          {/* Markers */}
          <div className="relative">
            <button
              onClick={() => setShowMarkerTooltip(!showMarkerTooltip)}
              className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all duration-300"
            >
              <Flag className="w-5 h-5" />
            </button>
            {showMarkerTooltip && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/95 backdrop-blur-sm border border-white/20 rounded-sm px-4 py-2 whitespace-nowrap shadow-[0_4px_16px_rgba(0,0,0,0.8)]">
                <p className="text-white text-xs font-medium tracking-wide">Place Marker</p>
              </div>
            )}
          </div>

          <div className="w-px h-8 bg-white/10 mx-1" />

          {/* End Session */}
          <button className="w-12 h-12 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center transition-all duration-300 shadow-[0_0_16px_rgba(255,255,255,0.2)]">
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Panel Toggle */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 text-white hover:bg-white/10 flex items-center justify-center transition-all duration-300 z-40"
      >
        <div className="flex flex-col gap-1">
          <div className="w-4 h-px bg-white" />
          <div className="w-4 h-px bg-white" />
          <div className="w-4 h-px bg-white" />
        </div>
      </button>
    </div>
  )
}
