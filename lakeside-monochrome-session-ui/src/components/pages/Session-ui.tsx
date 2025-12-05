"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, Circle, Flag, PhoneOff, Menu } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { io } from "socket.io-client";
import { createClient } from "@/utils/supabase/client";

export default function SessionRoom({ roomId }: { roomId: string }) {

    // UI States
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [activeTab, setActiveTab] = useState("whiteboard");
    const [activeSpeaker, setActiveSpeaker] = useState<number | null>(1);
    const [showMarkerTooltip, setShowMarkerTooltip] = useState(false);

    // REAL participant list (dynamic)
    const [participants, setParticipants] = useState<any[]>([]);

    // Chat State
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState("");
    const chatScrollRef = useRef<HTMLDivElement>(null);

    // Socket reference
    const socketRef = useRef<any>(null);

    // ----------------------------------------
    // STEP 3: Supabase Token + Socket Connection
    // ----------------------------------------
    useEffect(() => {
        async function init() {
            const supabase = createClient();

            // Get Supabase user session + token
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (!token) {
                alert("You must be logged in to join a room.");
                return;
            }

            // Add MYSELF to the list immediately
            const currentUser = {
                userId: session.user.id,
                email: session.user.email,
                isLocal: true // helpful flag
            };
            setParticipants([currentUser]);

            // Connect to backend Socket.IO server
            const socket = io("http://localhost:3001", {
                auth: { token },
            });

            socketRef.current = socket;

            // Once connected, join this meeting room
            socket.on("connect", () => {
                console.log("Connected:", socket.id);
                socket.emit("join-room", { roomId });
            });

            // Load existing participants (sent to ME when I join)
            socket.on("existing-participants", (users) => {
                console.log("Existing participants:", users);
                setParticipants((prev) => {
                    // Filter out any duplicates just in case
                    const newUsers = users.filter((u: any) => !prev.some((p) => p.userId === u.userId));
                    return [...prev, ...newUsers];
                });
            });

            // Someone else joined
            socket.on("user-joined", (data) => {
                console.log("User joined:", data);

                setParticipants((prev) => {
                    const exists = prev.some((p) => p.userId === data.userId);
                    return exists ? prev : [...prev, data];
                });
            });

            // Chat History
            socket.on("chat-history", (history) => {
                setChatMessages(history);
                scrollToBottom();
            });

            // Receive Message
            socket.on("receive-message", (message) => {
                setChatMessages((prev) => [...prev, message]);
                scrollToBottom();
            });

            // Request history on join
            socket.emit("request-chat-history", { roomId });

            return () => {
                socket.disconnect();
            };
        }

        init();
    }, [roomId]);

    const scrollToBottom = () => {
        if (chatScrollRef.current) {
            setTimeout(() => {
                chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
            }, 100);
        }
    };

    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || !socketRef.current) return;

        socketRef.current.emit("send-message", {
            roomId,
            text: chatInput
        });

        setChatInput("");
    };

    // ----------------------------------------------------
    // UI RETURN (your original UI is preserved exactly)
    // Except: video grid now uses `participants` instead of mock
    // ----------------------------------------------------
    return (
        <div className="h-screen w-full bg-black flex flex-col overflow-hidden">

            {/* Recording Indicator */}
            {isRecording && (
                <div className="absolute top-6 left-6 z-50 flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm border border-white/10 rounded-full">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-white text-xs font-medium tracking-wide">REC</span>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 flex overflow-hidden">

                {/* Video Grid */}
                <div className="flex-1 p-6 flex items-center justify-center">
                    <div className="w-full h-full grid grid-cols-3 gap-[1px] max-w-7xl">

                        {participants.length === 0 && (
                            <div className="col-span-3 text-center text-white/40">
                                Waiting for partics…
                            </div>
                        )}

                        {participants.map((p) => (
                            <div
                                key={p.userId}
                                className="relative bg-black border border-white/20 overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center">
                                    <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                        <span className="text-4xl font-light text-white/80">
                                            {p.email?.slice(0, 2).toUpperCase()}
                                        </span>
                                    </div>
                                </div>

                                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                    <span className="text-sm font-medium text-white tracking-wide">
                                        {p.email}
                                    </span>
                                </div>

                            </div>
                        ))}

                    </div>
                </div>

                {/* Right Panel */}
                <div className={`transition-all duration-500 border-l border-white/10 ${isPanelOpen ? "w-96" : "w-0"} overflow-hidden`}>
                    <div className="w-96 h-full bg-black/50 backdrop-blur-xl flex flex-col p-6">

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                            <TabsList className="bg-black/40 border border-white/10 p-1">
                                <TabsTrigger
                                    value="whiteboard"
                                    className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60 font-medium tracking-wide text-xs transition-all"
                                >
                                    Whiteboard
                                </TabsTrigger>
                                <TabsTrigger
                                    value="attendance"
                                    className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60 font-medium tracking-wide text-xs transition-all"
                                >
                                    Attendance
                                </TabsTrigger>
                                <TabsTrigger
                                    value="chat"
                                    className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60 font-medium tracking-wide text-xs transition-all"
                                >
                                    Chat
                                </TabsTrigger>
                                <TabsTrigger
                                    value="polls"
                                    className="data-[state=active]:bg-white data-[state=active]:text-black text-white/60 font-medium tracking-wide text-xs transition-all"
                                >
                                    Polls
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="whiteboard" className="flex-1 mt-6">
                                <div className="h-full bg-white rounded-sm border border-white/20 p-4 flex items-center justify-center">
                                    <span className="text-black/40 text-sm font-medium">Canvas Area</span>
                                </div>
                            </TabsContent>

                            <TabsContent value="attendance" className="flex-1 mt-6 overflow-auto">
                                <div className="space-y-4">
                                    {participants.map((p, idx) => (
                                        <div key={idx} className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-white text-sm font-medium tracking-wide">{p.email}</span>
                                                <span className="text-white/40 text-xs font-mono">Active</span>
                                            </div>
                                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-white transition-all duration-1000"
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                    {participants.length === 0 && (
                                        <div className="text-white/40 text-sm">No participants yet</div>
                                    )}
                                </div>
                            </TabsContent>

                            <TabsContent value="chat" className="flex-1 mt-6 flex flex-col overflow-hidden">
                                <div className="flex-1 overflow-y-auto space-y-4 pr-2" ref={chatScrollRef}>
                                    {chatMessages.length === 0 && (
                                        <div className="text-white/40 text-sm text-center mt-10">No messages yet</div>
                                    )}
                                    {chatMessages.map((msg, idx) => (
                                        <div key={idx} className="flex flex-col gap-1">
                                            <div className="flex items-baseline justify-between">
                                                <span className="text-xs font-bold text-white/90">{msg.email?.split('@')[0]}</span>
                                                <span className="text-[10px] text-white/40">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="bg-white/10 rounded-lg p-2 text-sm text-white/90 break-words">
                                                {msg.text}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!chatInput.trim()}
                                        className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        Send
                                    </button>
                                </form>
                            </TabsContent>

                            <TabsContent value="polls" className="flex-1 mt-6">
                                <div className="text-white/60 text-sm">Polls coming soon…</div>
                            </TabsContent>
                        </Tabs>

                    </div>
                </div>

            </div>

            {/* Floating control bar */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40">
                <div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-full px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center gap-3">

                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isMuted
                            ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.3)]'
                            : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                    >
                        {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    </button>

                    <button
                        onClick={() => setIsVideoOff(!isVideoOff)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isVideoOff
                            ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.3)]'
                            : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                    >
                        {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                    </button>

                    <button className="w-12 h-12 rounded-full bg-white/10 text-white hover:bg-white/20 border border-white/10 flex items-center justify-center transition-all duration-300">
                        <MonitorUp className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => setIsRecording(!isRecording)}
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording
                            ? 'bg-white text-black shadow-[0_0_16px_rgba(255,255,255,0.3)]'
                            : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                            }`}
                    >
                        <Circle className={`w-5 h-5 ${isRecording ? 'fill-current' : ''}`} />
                    </button>

                    <div className="w-px h-8 bg-white/10 mx-1" />

                    <button className="w-12 h-12 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center transition-all duration-300 shadow-[0_0_16px_rgba(255,255,255,0.2)]">
                        <PhoneOff className="w-5 h-5" />
                    </button>

                </div>
            </div>

            {/* Toggle Panel Button */}
            <button
                onClick={() => setIsPanelOpen(!isPanelOpen)}
                className="absolute top-6 right-6 w-10 h-10 rounded-full bg-black/80 backdrop-blur-sm border border-white/20 text-white hover:bg-white/10 flex items-center justify-center transition-all duration-300 z-40"
            >
                <Menu className="w-5 h-5" />
            </button>

        </div>
    );
}
