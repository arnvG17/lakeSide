"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, Circle, PhoneOff, Menu } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { io } from "socket.io-client";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import dynamic from "next/dynamic";

// Dynamically import Excalidraw to avoid SSR issues
const Excalidraw = dynamic(
    async () => (await import("@excalidraw/excalidraw")).Excalidraw,
    { ssr: false }
);

/**
 * SessionRoom (complete rewrite)
 *
 * - Screen-share-first WebRTC (no camera fallback)
 * - Proper offer creation AFTER adding local tracks
 * - Sharer renegotiates for late joiners (on user-joined)
 * - Single-screen-sharer UX depends on server enforcement; client handles denial
 * - Streams attached reliably to <video> elements
 *
 * Assumptions:
 * - Backend Socket.IO supports events:
 *   'join-room', 'existing-participants', 'user-joined', 'user-left',
 *   'start-screen-share', 'stop-screen-share', 'screen-share-started',
 *   'screen-share-stopped', 'screen-share-denied',
 *   'webrtc-offer', 'webrtc-answer', 'webrtc-ice-candidate'
 */

type Participant = {
    userId: string;
    email?: string;
    socketId?: string;
    isLocal?: boolean;
    streams?: MediaStream[]; // array of media streams (camera/screen etc.)
};

export default function SessionRoom({ roomId }: { roomId: string }) {
    // UI states
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [activeTab, setActiveTab] = useState("whiteboard");

    // participants & chat
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState("");
    const chatScrollRef = useRef<HTMLDivElement | null>(null);

    // screen share state
    const [screenSharers, setScreenSharers] = useState<Set<string>>(new Set());
    const [isConnected, setIsConnected] = useState(false);

    // featured tile state (Google Meet style)
    const [featuredTile, setFeaturedTile] = useState<{ userId: string; streamId: string } | null>(null);

    // persistent refs
    const socketRef = useRef<any>(null);
    const myUserIdRef = useRef<string | null>(null);
    const localScreenRef = useRef<MediaStream | null>(null); // local screen stream
    const localPreviewRef = useRef<HTMLVideoElement | null>(null);
    const peersRef = useRef<Record<string, RTCPeerConnection>>({}); // userId -> pc
    const pendingOfferLock = useRef<Record<string, boolean>>({}); // avoid concurrent offers to same user

    // ICE config (add TURN as env for production)
    const ICE_CONFIG = {
        iceServers: (() => {
            const servers: any[] = [{ urls: ["stun:stun.l.google.com:19302"] }];
            if (process.env.NEXT_PUBLIC_TURN_URL && process.env.NEXT_PUBLIC_TURN_USER) {
                servers.push({
                    urls: [process.env.NEXT_PUBLIC_TURN_URL],
                    username: process.env.NEXT_PUBLIC_TURN_USER,
                    credential: process.env.NEXT_PUBLIC_TURN_PASS || ""
                });
            }
            return servers;
        })()
    };

    // -------------------------
    // Helpers: participant state
    // -------------------------
    const upsertParticipant = (p: Participant) => {
        setParticipants(prev => {
            const index = prev.findIndex(x => x.userId === p.userId);
            if (index === -1) return [...prev, p];

            // Merge, but preserve existing streams if incoming has none/empty
            const existing = prev[index];
            const merged = { ...existing, ...p };

            // If we already have streams and the update has empty streams (likely just metadata update), keep ours
            if (existing.streams && existing.streams.length > 0) {
                if (!p.streams || p.streams.length === 0) {
                    merged.streams = existing.streams;
                }
            }

            const newArr = [...prev];
            newArr[index] = merged;
            return newArr;
        });
    };

    const removeParticipant = (userId: string) => {
        setParticipants(prev => prev.filter(p => p.userId !== userId));
    };

    const addStreamToParticipant = (userId: string, stream: MediaStream) => {
        console.log(`[Session] addStreamToParticipant ${userId} stream=${stream.id}`);
        setParticipants(prev => {
            const index = prev.findIndex(p => p.userId === userId);

            if (index === -1) {
                console.warn(`[Session] addStreamToParticipant: User ${userId} not found, creating placeholder`);
                return [...prev, {
                    userId,
                    isLocal: false,
                    streams: [stream],
                    email: "Connecting..." // Placeholder until user details arrive
                }];
            }

            // User exists, update their streams
            const p = prev[index];
            const streams = p.streams ? [...p.streams] : [];

            if (!streams.some(s => s.id === stream.id)) {
                console.log(`[Session] Adding new stream ${stream.id} to user ${userId}`);
                streams.push(stream);
            } else {
                console.log(`[Session] Stream ${stream.id} already exists for user ${userId}`);
            }

            // Return new array with updated participant
            const newParticipants = [...prev];
            newParticipants[index] = { ...p, streams };
            return newParticipants;
        });
    };

    const removeStreamFromParticipant = (userId: string, streamId: string) => {
        setParticipants(prev => prev.map(p => {
            if (p.userId !== userId) return p;
            return { ...p, streams: (p.streams || []).filter(s => s.id !== streamId) };
        }));
    };

    // ------------------------
    // PeerConnection factory
    // -------------------------
    function createPeerConnection(remoteUserId: string) {
        if (peersRef.current[remoteUserId]) return peersRef.current[remoteUserId];

        const pc = new RTCPeerConnection(ICE_CONFIG);
        peersRef.current[remoteUserId] = pc;

        // add local screen tracks (if present)
        if (localScreenRef.current) {
            localScreenRef.current.getTracks().forEach(track => pc.addTrack(track, localScreenRef.current!));
        }

        // ICE -> send to peer via server
        pc.onicecandidate = (ev) => {
            if (ev.candidate && socketRef.current) {
                socketRef.current.emit("webrtc-ice-candidate", {
                    roomId,
                    targetUserId: remoteUserId,
                    candidate: ev.candidate
                });
            }
        };

        // handle remote tracks
        pc.ontrack = (ev) => {
            console.log(`[WebRTC] ontrack from ${remoteUserId}`, ev.streams);
            const remoteStream = (ev.streams && ev.streams[0]) || null;
            if (!remoteStream) {
                console.warn(`[WebRTC] ontrack fired but no stream found for ${remoteUserId}`);
                return;
            }
            addStreamToParticipant(remoteUserId, remoteStream);
        };

        // cleanup on state change
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
                try { pc.close(); } catch (e) { }
                delete peersRef.current[remoteUserId];
            }
        };

        return pc;
    }

    // -------------------------
    // Start screen share (local user)
    // -------------------------
    async function startScreenShare() {
        if (!socketRef.current) {
            toast.error("Socket not connected");
            return;
        }

        // ask server if allowed; server may reply 'screen-share-denied'
        socketRef.current.emit("start-screen-share", { roomId });

        // Wait a tick for server to respond with allowed/denied.
        // We still proceed to open getDisplayMedia; if server denies it will send 'screen-share-denied' - we'll stop.
        try {
            const screenStream: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
            localScreenRef.current = screenStream;

            // local preview
            if (localPreviewRef.current) {
                localPreviewRef.current.srcObject = screenStream;
                try { await localPreviewRef.current.play(); } catch (e) { }
            }

            // attach to local participant
            upsertParticipant(prevLocalParticipant());

            // ensure track.onended triggers stop
            const vtrack = screenStream.getVideoTracks()[0];
            if (vtrack) vtrack.onended = () => {
                stopScreenShare();
            }

            // For each existing remote participant -> create PC (if not exists), add tracks, createOffer
            // Note: createOffer AFTER adding tracks
            const currentParticipants = participants.slice(); // snapshot
            for (const p of currentParticipants) {
                if (p.isLocal) continue;
                const targetId = p.userId;
                // create pc and add tracks
                const pc = createPeerConnection(targetId);

                // add tracks (idempotent-ish)
                screenStream.getTracks().forEach(track => pc.addTrack(track, screenStream));

                // avoid concurrent offers to same peer
                if (pendingOfferLock.current[targetId]) continue;
                pendingOfferLock.current[targetId] = true;

                try {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socketRef.current.emit("webrtc-offer", {
                        roomId,
                        targetUserId: targetId,
                        offer: pc.localDescription
                    });
                } catch (err) {
                    console.error("Offer failed for", targetId, err);
                } finally {
                    pendingOfferLock.current[targetId] = false;
                }
            }
        } catch (err) {
            console.error("getDisplayMedia failed or user denied", err);
            // If user denied, tell server to clear sharer state (server might have already denied)
            socketRef.current.emit("stop-screen-share", { roomId });
        }
    }

    // -------------------------
    // Stop screen share (local user)
    // -------------------------
    function stopScreenShare() {
        try {
            if (localScreenRef.current) {
                localScreenRef.current.getTracks().forEach(t => {
                    try { t.stop(); } catch (e) { }
                });
            }
        } catch (e) {
            console.warn("Error stopping local tracks", e);
        }

        // remove local screen streams from local participant
        const myId = myUserIdRef.current;
        if (myId) {
            setParticipants(prev => prev.map(p => p.userId === myId ? { ...p, streams: (p.streams || []).filter(s => s.active) } : p));
        }

        // remove senders corresponding to screen tracks on each PC (best-effort)
        Object.values(peersRef.current).forEach(pc => {
            try {
                pc.getSenders().forEach(sender => {
                    if (sender.track && sender.track.kind === "video") {
                        try { pc.removeTrack(sender); } catch (e) { }
                    }
                });
            } catch (e) {
                console.warn("Error removing sender:", e);
            }
        });

        // notify server to clear screen sharer
        if (socketRef.current) socketRef.current.emit("stop-screen-share", { roomId });

        localPreviewRef.current && (localPreviewRef.current.srcObject = null);
        localScreenRef.current = null;
    }

    // -------------------------
    // Helper: get local participant object
    // -------------------------
    function prevLocalParticipant(): Participant {
        const myId = myUserIdRef.current;
        return {
            userId: myId || "unknown",
            email: "", // email may be updated later from existing-participants
            isLocal: true,
            streams: localScreenRef.current ? [localScreenRef.current] : []
        };
    }

    // -------------------------
    // handle button click
    // -------------------------
    const handleScreenShare = () => {
        if (!socketRef.current) {
            toast.error("Socket not ready");
            return;
        }
        const myId = myUserIdRef.current;
        if (!myId) return;

        // Check if I am already sharing
        if (localScreenRef.current) {
            stopScreenShare();
        } else {
            startScreenShare();
        }
    };

    // -------------------------
    // Socket & signaling setup
    // -------------------------
    useEffect(() => {
        let mounted = true;

        (async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) {
                toast.error("Login required");
                return;
            }

            // set my user id
            myUserIdRef.current = session.user.id;

            // add local participant placeholder
            upsertParticipant({
                userId: session.user.id,
                email: session.user.email,
                isLocal: true,
                streams: []
            });

            // connect
            const s = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001", {
                auth: { token },
                transports: ["websocket"]
            });
            socketRef.current = s;

            s.on("connect", () => {
                setIsConnected(true);
                s.emit("join-room", { roomId });
            });

            // existing participants + optional screenSharers info sent by server
            s.on("existing-participants", (payload: any) => {
                // server may send either array or { users, screenSharers }
                if (!payload) return;
                let users = payload;
                let remoteScreenSharers: string[] = [];

                if (payload.users) {
                    users = payload.users;
                    if (Array.isArray(payload.screenSharers)) {
                        remoteScreenSharers = payload.screenSharers;
                    }
                }

                // upsert users
                users.forEach((u: any) => {
                    if (u.id === myUserIdRef.current || u.userId === myUserIdRef.current) return;
                    upsertParticipant({
                        userId: u.userId || u.id,
                        email: u.email,
                        socketId: u.socketId,
                        isLocal: false,
                        streams: []
                    });
                });

                // set current screen sharers
                if (remoteScreenSharers.length > 0) {
                    setScreenSharers(new Set(remoteScreenSharers));
                }
            });

            // someone joined
            s.on("user-joined", (u: any) => {
                console.log(`[Session] user-joined: ${u.email} (${u.userId})`);
                const userId = u.userId || u.id;
                if (userId === myUserIdRef.current) return;
                upsertParticipant({
                    userId,
                    email: u.email,
                    socketId: u.socketId,
                    isLocal: false,
                    streams: []
                });

                // If I am the current sharer, immediately create PC and offer to the new user
                if (localScreenRef.current) {
                    console.log(`[Session] I am sharing, initiating offer to new user ${userId}`);
                    // someone new joined and I am sharing -> create offer for them
                    (async () => {
                        const targetId = userId;
                        const pc = createPeerConnection(targetId);

                        // add local screen tracks BEFORE offer
                        // Note: createPeerConnection already adds tracks if localScreenRef is set.
                        // We double check here just in case, but rely on createPeerConnection for the initial add.
                        // If we add again, it might be redundant but safe if track ids match.
                        // Let's log track count.
                        console.log(`[Session] PC senders count: ${pc.getSenders().length}`);

                        if (pendingOfferLock.current[targetId]) {
                            console.warn(`[Session] Offer pending for ${targetId}, skipping`);
                            return;
                        }
                        pendingOfferLock.current[targetId] = true;

                        try {
                            const offer = await pc.createOffer();
                            await pc.setLocalDescription(offer);
                            console.log(`[Session] Sending webrtc-offer to ${targetId}`);
                            s.emit("webrtc-offer", {
                                roomId,
                                targetUserId: targetId,
                                offer: pc.localDescription
                            });
                        } catch (err) {
                            console.error("Offer to new user failed", err);
                        } finally {
                            pendingOfferLock.current[targetId] = false;
                        }
                    })();
                } else {
                    console.log(`[Session] I am NOT sharing, no offer needed for ${userId}`);
                }
            });

            // someone left
            s.on("user-left", ({ userId }: { userId: string }) => {
                // close pc if exists
                const pc = peersRef.current[userId];
                if (pc) {
                    try { pc.close(); } catch (e) { }
                    delete peersRef.current[userId];
                }
                removeParticipant(userId);
            });

            // server notifies start/stop screen share
            s.on("screen-share-started", ({ userId, email }: any) => {
                setScreenSharers(prev => new Set(prev).add(userId));
                toast.info(`${email || "Someone"} started screen sharing`);
            });

            s.on("screen-share-stopped", ({ userId }: any) => {
                // remove non-active streams for that user
                setScreenSharers(prev => {
                    const next = new Set(prev);
                    next.delete(userId);
                    return next;
                });
                // cleanup streams that became inactive
                setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, streams: (p.streams || []).filter(s => s.active) } : p));
                toast.info("Screen sharing stopped");
            });

            s.on("screen-share-denied", ({ reason }: any) => {
                toast.error(`Screen share denied: ${reason}`);
                // if we had started capturing, stop immediately
                if (localScreenRef.current) stopScreenShare();
            });

            // chat
            s.on("chat-history", (history: any[]) => {
                setChatMessages(history || []);
                setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight }), 100);
            });

            s.on("receive-message", (message: any) => {
                setChatMessages(prev => [...prev, message]);
                setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight }), 100);
            });

            // ----------------------------
            // WebRTC signaling handlers
            // ----------------------------
            s.on("webrtc-offer", async ({ fromUserId, offer }: any) => {
                // received an offer (someone initiated to us)
                // create PC for that user and respond with answer
                const pc = createPeerConnection(fromUserId);
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    // Note: if we need to send tracks back (e.g., if we also have camera), we'd add them here
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    s.emit("webrtc-answer", {
                        roomId,
                        targetUserId: fromUserId,
                        answer: pc.localDescription
                    });
                } catch (err) {
                    console.error("Error handling offer", err);
                }
            });

            s.on("webrtc-answer", async ({ fromUserId, answer }: any) => {
                const pc = peersRef.current[fromUserId];
                if (!pc) return;
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) {
                    console.error("Error applying answer", err);
                }
            });

            s.on("webrtc-ice-candidate", async ({ fromUserId, candidate }: any) => {
                const pc = peersRef.current[fromUserId];
                if (!pc || !candidate) return;
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error("Error adding ICE candidate", err);
                }
            });

            // request chat history
            s.emit("request-chat-history", { roomId });

            // cleanup on unmount
            return () => {
                mounted = false;
                try { s.disconnect(); } catch (_) { }
                // close all PCs
                Object.values(peersRef.current).forEach(pc => {
                    try { pc.close(); } catch (e) { }
                });
                peersRef.current = {};
            };
        })();
    }, [roomId]); // run once per room

    // -------------------------
    // Auto-feature screen shares
    // -------------------------
    useEffect(() => {
        // Auto-select first screen share as featured
        if (screenSharers.size > 0 && !featuredTile) {
            const firstSharer = Array.from(screenSharers)[0];
            const participant = participants.find(p => p.userId === firstSharer);
            if (participant && participant.streams && participant.streams.length > 0) {
                setFeaturedTile({ userId: firstSharer, streamId: participant.streams[0].id });
            }
        }

        // Clear featured tile if that participant left
        if (featuredTile) {
            const stillExists = participants.some(p =>
                p.userId === featuredTile.userId &&
                p.streams?.some(s => s.id === featuredTile.streamId)
            );
            if (!stillExists) {
                setFeaturedTile(null);
            }
        }
    }, [screenSharers, participants, featuredTile]);

    // -------------------------
    // chat send
    // -------------------------
    const handleSendMessage = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || !socketRef.current) return;
        socketRef.current.emit("send-message", { roomId, text: chatInput });
        setChatInput("");
    };

    // -------------------------
    // Render helpers
    // -------------------------
    // assign srcObject to <video> when element mounts
    const attachStreamToVideo = (el: HTMLVideoElement | null, stream: MediaStream | undefined) => {
        if (!el) return;
        if (!stream) {
            el.srcObject = null;
            return;
        }
        if (el.srcObject !== stream) {
            el.srcObject = stream;
            try { el.play().catch(() => { }); } catch (_) { }
        }
    };

    // -------------------------
    // UI render
    // -------------------------
    return (
        <div className="h-screen w-full bg-black flex flex-col overflow-hidden" style={{ height: '100dvh' }}>
            {/* Local preview (hidden small preview) */}
            <video ref={localPreviewRef} autoPlay muted playsInline className="hidden" />

            <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
                <div className="flex-1 p-2 sm:p-4 md:p-6 flex flex-col gap-2 sm:gap-4">
                    {/* Main Featured View */}
                    <div className="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden">
                        {featuredTile ? (
                            (() => {
                                const participant = participants.find(p => p.userId === featuredTile.userId);
                                const stream = participant?.streams?.find(s => s.id === featuredTile.streamId);

                                if (participant && stream) {
                                    return (
                                        <div className="relative w-full h-full bg-black">
                                            <video
                                                autoPlay
                                                playsInline
                                                muted={participant.isLocal}
                                                ref={el => attachStreamToVideo(el, stream)}
                                                className="w-full h-full object-contain"
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
                                                <span className="text-lg font-medium text-white tracking-wide">
                                                    {participant.email}
                                                    {screenSharers.has(participant.userId) && " (Screen Share)"}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="text-white/40 text-center">
                                        Select a participant to view
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="text-white/40 text-center">
                                {participants.length === 0 ? "Waiting for participants…" : "Click a thumbnail below to view"}
                            </div>
                        )}
                    </div>

                    {/* Thumbnails Strip */}
                    <div className="h-24 sm:h-32 flex gap-2 overflow-x-auto pb-2 -webkit-overflow-scrolling-touch">
                        {participants.map(p => {
                            // Show all streams for each participant
                            if (p.streams && p.streams.length > 0) {
                                return p.streams.map((s, idx) => {
                                    const isSelected = featuredTile?.userId === p.userId && featuredTile?.streamId === s.id;
                                    return (
                                        <div
                                            key={`${p.userId}-stream-${s.id}`}
                                            onClick={() => setFeaturedTile({ userId: p.userId, streamId: s.id })}
                                            className={`relative flex-shrink-0 w-48 h-full bg-black rounded-lg overflow-hidden cursor-pointer transition-all ${isSelected ? 'ring-4 ring-white scale-105' : 'ring-2 ring-white/20 hover:ring-white/60'
                                                }`}
                                        >
                                            <video
                                                autoPlay
                                                playsInline
                                                muted={p.isLocal}
                                                ref={el => attachStreamToVideo(el, s)}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                                <span className="text-xs font-medium text-white tracking-wide block truncate">
                                                    {p.email} {idx > 0 ? "(screen)" : ""}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                });
                            }

                            // Fallback avatar tile for participants without streams
                            return (
                                <div
                                    key={p.userId}
                                    onClick={() => {
                                        // If they have no streams, we can't feature them, but we can still select for future
                                        if (p.streams && p.streams.length > 0) {
                                            setFeaturedTile({ userId: p.userId, streamId: p.streams[0].id });
                                        }
                                    }}
                                    className="relative flex-shrink-0 w-48 h-full bg-gradient-to-br from-zinc-900 to-black rounded-lg overflow-hidden cursor-pointer ring-2 ring-white/20 hover:ring-white/60 transition-all"
                                >
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                            <span className="text-2xl font-light text-white/80">
                                                {p.email ? p.email.slice(0, 2).toUpperCase() : p.userId.slice(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                                        <span className="text-xs font-medium text-white tracking-wide block truncate">{p.email}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Panel */}
                <div className={`transition-all duration-500 border-l border-white/10 ${isPanelOpen ? "w-full md:w-96" : "w-0"} overflow-hidden fixed md:relative inset-0 md:inset-auto z-50 md:z-auto`}>
                    <div className="w-full md:w-96 h-full bg-black/90 md:bg-black/50 backdrop-blur-xl flex flex-col p-4 sm:p-6">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                            <TabsList className="bg-black/40 border border-white/10 p-1">
                                <TabsTrigger value="whiteboard" className="text-white data-[state=active]:text-black">Whiteboard</TabsTrigger>
                                <TabsTrigger value="attendance" className="text-white data-[state=active]:text-black">Attendance</TabsTrigger>
                                <TabsTrigger value="chat" className="text-white data-[state=active]:text-black">Chat</TabsTrigger>
                                <TabsTrigger value="polls" className="text-white data-[state=active]:text-black">Polls</TabsTrigger>
                            </TabsList>

                            <TabsContent value="whiteboard" className="flex-1 mt-6 overflow-hidden">
                                <div className="h-full bg-white rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
                                    <Excalidraw
                                        theme="light"
                                        initialData={{
                                            appState: {
                                                viewBackgroundColor: "#ffffff"
                                            }
                                        }}
                                    />
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
                                                <div className="h-full bg-white transition-all duration-1000" style={{ width: '100%' }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>

                            <TabsContent value="chat" className="flex-1 mt-6 flex flex-col overflow-hidden min-h-0">
                                <div className="flex-1 overflow-y-auto space-y-4 pr-2 overscroll-contain min-h-0" ref={chatScrollRef} style={{ WebkitOverflowScrolling: 'touch' }}>
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
                                            <div className="bg-white/10 rounded-lg p-2 text-sm text-white/90 break-words">{msg.text}</div>
                                        </div>
                                    ))}
                                </div>

                                <form onSubmit={handleSendMessage} className="mt-4 flex gap-2">
                                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} type="text" className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white" placeholder="Type a message..." />
                                    <button type="submit" disabled={!chatInput.trim()} className="bg-white text-black px-4 py-2 rounded-md text-sm font-medium">Send</button>
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
            <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 z-40">
                <div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-full px-2 sm:px-4 py-2 sm:py-3 shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center gap-1.5 sm:gap-3">
                    <button onClick={() => setIsMuted(!isMuted)} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                        {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>

                    <button onClick={() => setIsVideoOff(!isVideoOff)} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${isVideoOff ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                        {isVideoOff ? <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>

                    <button onClick={handleScreenShare} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${localScreenRef.current ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                        <MonitorUp className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <button onClick={() => setIsRecording(!isRecording)} className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${isRecording ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                        <Circle className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>

                    <div className="w-px h-6 sm:h-8 bg-white/10 mx-0.5 sm:mx-1" />

                    <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white text-black flex items-center justify-center">
                        <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                </div>
            </div>

            {/* Toggle panel */}
            <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 rounded-full bg-black/80 border border-white/20 text-white flex items-center justify-center z-[60]">
                <Menu className="w-5 h-5" />
            </button>
        </div>
    );
}
