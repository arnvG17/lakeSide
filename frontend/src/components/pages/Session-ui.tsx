"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, MonitorUp, Circle, PhoneOff, Menu, X, ArrowRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { io } from "socket.io-client";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useTranscription } from "@/hooks/useTranscription";
import { useFragmentedRecorder } from "@/hooks/useFragmentedRecorder";
import { useFragmentUploader } from "@/hooks/useFragmentUploader";
import { ShaderBackground } from "@/components/ui/hero-shader";
import { PixelTrail } from "@/components/ui/pixel-trail";
import { useScreenSize } from "@/components/hooks/use-screen-size";
import { motion, AnimatePresence } from "framer-motion";
import { AnnotationBoard } from "@/components/AnnotationBoard";

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
    isMuted?: boolean;
    isCameraOff?: boolean;
};


export default function SessionRoom({ roomId }: { roomId: string }) {
    // UI states
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [activeTab, setActiveTab] = useState("transcript");
    const [isMobile, setIsMobile] = useState(false);

    // participants & chat
    const screenSize = useScreenSize();
    const [participants, setParticipants] = useState<Participant[]>([]);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [chatInput, setChatInput] = useState("");
    const chatScrollRef = useRef<HTMLDivElement | null>(null);

    // Transcript history for the new tab - includes timestamps for VTT subtitle generation
    type TranscriptEntryWithMeta = { text: string; startTime: number; endTime: number; timestamp: Date; speaker: string };
    const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntryWithMeta[]>([]);
    const transcriptHistoryRef = useRef<TranscriptEntryWithMeta[]>([]); // Ref for auto-save on unmount
    const transcriptScrollRef = useRef<HTMLDivElement | null>(null);

    // screen share state
    const [screenSharers, setScreenSharers] = useState<Set<string>>(new Set());
    const [isConnected, setIsConnected] = useState(false);
    const [mediaInitialized, setMediaInitialized] = useState(false);

    // featured tile state (Google Meet style)
    const [featuredTile, setFeaturedTile] = useState<{ userId: string; streamId: string } | null>(null);

    // persistent refs
    const socketRef = useRef<any>(null);
    const myUserIdRef = useRef<string | null>(null);
    const localScreenRef = useRef<MediaStream | null>(null); // local screen stream
    const localMediaStreamRef = useRef<MediaStream | null>(null); // local camera/mic stream
    const localPreviewRef = useRef<HTMLVideoElement | null>(null);
    const peersRef = useRef<Record<string, RTCPeerConnection>>({}); // userId -> pc
    const pendingOfferLock = useRef<Record<string, boolean>>({}); // avoid concurrent offers to same user

    // Recording timer state
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Fragmented Recorder (Riverside-style)
    const fragmentedRecorder = useFragmentedRecorder(
        (fragment) => fragmentUploader.enqueueFragment(fragment)
    );
    const fragmentUploader = useFragmentUploader(fragmentedRecorder.state.sessionId);

    // Transcription Hook
    // Replace address with your public IP if testing on other devices
    const { startTranscription, stopTranscription, transcript, isPlaying: isTranscribing } = useTranscription(
        "wss://lakeside-asr.onrender.com/ws/transcribe",
        {
            onAudioRecognized: () => {
                // Audio recognized - transcription is working
            },
            onTranscript: (entry) => {
                // Entry now contains { text, startTime, endTime }
                console.log('[Session] Received transcript:', entry);

                const localParticipant = participants.find(p => p.isLocal);
                const speaker = localParticipant?.email?.split('@')[0] || 'You';

                // Add to local history immediately (so it shows up for this user)
                setTranscriptHistory(prev => {
                    // Check if the last entry is identical (duplicate event safeguard)
                    const last = prev[prev.length - 1];
                    if (last && last.text === entry.text && (new Date().getTime() - last.timestamp.getTime() < 2000)) {
                        return prev;
                    }
                    const newEntry = {
                        text: entry.text,
                        startTime: entry.startTime,
                        endTime: entry.endTime,
                        timestamp: new Date(),
                        speaker
                    };
                    console.log('[Session] Adding to transcript history:', newEntry);
                    return [...prev, newEntry];
                });

                // Also broadcast to all users via socket (so others see it too)
                if (socketRef.current && socketRef.current.connected) {
                    socketRef.current.emit('broadcast-transcript', {
                        roomId,
                        text: entry.text,
                        startTime: entry.startTime,
                        endTime: entry.endTime
                    });
                }

                // Auto-scroll
                setTimeout(() => transcriptScrollRef.current?.scrollTo({ top: transcriptScrollRef.current.scrollHeight }), 100);
            }
        }
    );

    // Generate VTT content from transcript history
    const generateVTT = (): string => {
        let vtt = "WEBVTT\n\n";
        transcriptHistory.forEach((entry, index) => {
            const formatTime = (seconds: number): string => {
                const hrs = Math.floor(seconds / 3600);
                const mins = Math.floor((seconds % 3600) / 60);
                const secs = Math.floor(seconds % 60);
                const ms = Math.floor((seconds % 1) * 1000);
                return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
            };
            vtt += `${index + 1}\n`;
            vtt += `${formatTime(entry.startTime)} --> ${formatTime(entry.endTime)}\n`;
            vtt += `${entry.text}\n\n`;
        });
        return vtt;
    };

    // Download VTT file
    const downloadVTT = () => {
        const vttContent = generateVTT();
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript-${roomId}-${new Date().toISOString().split('T')[0]}.vtt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("VTT subtitle file downloaded!");
    };

    // Keep ref in sync with state for auto-save on unmount
    useEffect(() => {
        transcriptHistoryRef.current = transcriptHistory;
    }, [transcriptHistory]);

    // Generate VTT from ref (for use in cleanup)
    const generateVTTFromRef = (): string => {
        let vtt = "WEBVTT\n\n";
        transcriptHistoryRef.current.forEach((entry, index) => {
            const formatTime = (seconds: number): string => {
                const hrs = Math.floor(seconds / 3600);
                const mins = Math.floor((seconds % 3600) / 60);
                const secs = Math.floor(seconds % 60);
                const ms = Math.floor((seconds % 1) * 1000);
                return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
            };
            vtt += `${index + 1}\n`;
            vtt += `${formatTime(entry.startTime)} --> ${formatTime(entry.endTime)}\n`;
            vtt += `${entry.text}\n\n`;
        });
        return vtt;
    };

    // Save transcript to database (can be called manually or on session end)
    const saveTranscriptToDatabase = async (silent = false) => {
        const history = transcriptHistoryRef.current;
        if (history.length === 0) {
            if (!silent) toast.error("No transcript to save");
            return;
        }
        try {
            const vttContent = generateVTTFromRef();
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/transcripts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    roomId,
                    content: vttContent,
                    format: 'vtt'
                })
            });
            if (response.ok) {
                if (!silent) toast.success("Transcript saved to database!");
            } else {
                if (!silent) toast.error("Failed to save transcript");
            }
        } catch (error) {
            console.error("Error saving transcript:", error);
            if (!silent) toast.error("Failed to save transcript");
        }
    };

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
            // UNLESS it's a local participant update where we explicitly passed streams
            if (p.isLocal) {
                // For local, we always trust the latest passed object because we control it
                // But we must be careful not to overwrite if we passed partial data
                if (p.streams !== undefined) {
                    merged.streams = p.streams;
                } else {
                    merged.streams = existing.streams;
                }
            } else {
                // For remote, if metadata update (no streams property), keep existing streams
                if (!p.streams || p.streams.length === 0) {
                    // If p.streams is explicit empty array, it might mean they stopped sharing?
                    // But usually metadata events (user-joined) don't carry streams
                    if (!p.streams) merged.streams = existing.streams;
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

    // -------------------------
    // PeerConnection factory
    // -------------------------
    function createPeerConnection(remoteUserId: string) {
        if (peersRef.current[remoteUserId]) return peersRef.current[remoteUserId];

        const pc = new RTCPeerConnection(ICE_CONFIG);
        peersRef.current[remoteUserId] = pc;

        // add local MEDIA tracks (camera/mic)
        if (localMediaStreamRef.current) {
            localMediaStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localMediaStreamRef.current!);
            });
        }

        // add local SCREEN tracks (if present)
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
    // Capture Local Media (Camera/Mic)
    // -------------------------
    async function enableUserMedia() {
        try {
            console.log("[Session] Requesting user media...");
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            console.log("[Session] User media acquired:", stream.id);
            localMediaStreamRef.current = stream;

            // Initially respect state (if default off)
            // But usually we start ON. Here we start ON unless set otherwise?
            // Let's assume start ON.

            // Add to local participant
            const p = prevLocalParticipant();
            console.log("[Session] Upserting local participant after media:", p);
            upsertParticipant(p);

            return stream;
        } catch (err) {
            console.error("Error accessing media devices.", err);
            toast.error("Could not access camera/microphone");
            return null;
        }
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

        try {
            if (!navigator.mediaDevices.getDisplayMedia) {
                toast.error("Screen sharing not supported on this device/browser");
                socketRef.current.emit("stop-screen-share", { roomId });
                return;
            }

            const screenStream: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
            localScreenRef.current = screenStream;

            // attach to local participant
            upsertParticipant(prevLocalParticipant());

            // ensure track.onended triggers stop
            const vtrack = screenStream.getVideoTracks()[0];
            if (vtrack) vtrack.onended = () => {
                stopScreenShare();
            }

            // For each existing remote participant -> create PC (if not exists), add tracks, createOffer
            const currentParticipants = participants.slice();
            for (const p of currentParticipants) {
                if (p.isLocal) continue;
                const targetId = p.userId;
                const pc = createPeerConnection(targetId);

                screenStream.getTracks().forEach(track => pc.addTrack(track, screenStream));

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
            // Force re-eval of prevLocalParticipant or just filter
            // We'll reset localScreenRef first
            localScreenRef.current = null;
            upsertParticipant(prevLocalParticipant());
        }

        // Use standard WebRTC removeTrack if possible, or just Renegotiation needed?
        // Simple way: just stop tracks. The other side receives 'ended' or black frames.
        // Ideally we negotiate to remove track.
        // For now, we rely on the track.stop() stopping it.

        localScreenRef.current = null;

        // notify server to clear screen sharer
        if (socketRef.current) socketRef.current.emit("stop-screen-share", { roomId });
    }

    // -------------------------
    // Helper: get local participant object
    // -------------------------
    function prevLocalParticipant(): Participant {
        const myId = myUserIdRef.current;
        const streams: MediaStream[] = [];
        if (localMediaStreamRef.current) streams.push(localMediaStreamRef.current);
        if (localScreenRef.current) streams.push(localScreenRef.current);

        return {
            userId: myId || "unknown",
            email: "", // email may be updated later from existing-participants
            isLocal: true,
            streams: streams
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

    const toggleMic = () => {
        if (localMediaStreamRef.current) {
            const audioTrack = localMediaStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
                if (socketRef.current) {
                    socketRef.current.emit("toggle-mic", { micOn: audioTrack.enabled });
                }
            }
        } else {
            // Maybe stream not loaded yet?
            setIsMuted(!isMuted);
        }
    };

    const toggleCamera = () => {
        if (localMediaStreamRef.current) {
            const videoTrack = localMediaStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
                if (socketRef.current) {
                    socketRef.current.emit("toggle-camera", { cameraOn: videoTrack.enabled });
                }
            }
        } else {
            setIsVideoOff(!isVideoOff);
        }
    };

    // -------------------------
    // Socket & signaling setup
    // -------------------------
    useEffect(() => {
        if (!mediaInitialized) return;

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

            // Media is already initialized by the other useEffect
            // We just ensure the placeholder is there with whatever streams we have
            upsertParticipant({
                userId: session.user.id,
                email: session.user.email,
                isLocal: true,
                streams: localMediaStreamRef.current ? [localMediaStreamRef.current] : []
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
                // Request chat and transcript history
                s.emit("request-chat-history", { roomId });
                s.emit("request-transcript-history", { roomId });
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

                // Always create PC and offer to the new user -> Mesh topology
                // The new user will answer.
                console.log(`[Session] Initiating offer to new user ${userId}`);
                (async () => {
                    const targetId = userId;
                    const pc = createPeerConnection(targetId);

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

            // transcript history (for persistence across reloads)
            s.on("transcript-history", (history: any[]) => {
                if (!history || history.length === 0) return;
                setTranscriptHistory(history.map((t: any) => ({
                    text: t.text,
                    startTime: t.startTime,
                    endTime: t.endTime,
                    timestamp: new Date(t.timestamp),
                    speaker: t.speaker
                })));
                setTimeout(() => transcriptScrollRef.current?.scrollTo({ top: transcriptScrollRef.current.scrollHeight }), 100);
                console.log(`[Session] Loaded ${history.length} transcripts from history`);
            });

            s.on("receive-message", (message: any) => {
                setChatMessages(prev => [...prev, message]);
                setTimeout(() => chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight }), 100);
            });

            // Transcript broadcast - receive from OTHER users in room
            s.on("receive-transcript", (data: any) => {
                // Skip if this is from ourselves (we already added it locally)
                if (data.userId === myUserIdRef.current) {
                    return;
                }

                setTranscriptHistory(prev => {
                    // Deduplicate by checking last entry
                    const last = prev[prev.length - 1];
                    if (last && last.text === data.text && (Date.now() - last.timestamp.getTime() < 2000)) {
                        return prev;
                    }
                    return [...prev, {
                        text: data.text,
                        startTime: data.startTime,
                        endTime: data.endTime,
                        timestamp: new Date(data.timestamp),
                        speaker: data.speaker
                    }];
                });
                // Auto-scroll
                setTimeout(() => transcriptScrollRef.current?.scrollTo({ top: transcriptScrollRef.current.scrollHeight }), 100);
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

            s.on("user-toggled-mic", ({ userId, micOn }: any) => {
                setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, isMuted: !micOn } : p));
            });
            s.on("user-toggled-camera", ({ userId, cameraOn }: any) => {
                setParticipants(prev => prev.map(p => p.userId === userId ? { ...p, isCameraOff: !cameraOn } : p));
            });

            // request chat history
            s.emit("request-chat-history", { roomId });

            // cleanup on unmount
        })();

        return () => {
            mounted = false;
            if (socketRef.current) {
                try { socketRef.current.disconnect(); } catch (_) { }
            }
            // close all PCs
            Object.values(peersRef.current).forEach(pc => {
                try { pc.close(); } catch (e) { }
            });
            peersRef.current = {};
        };
    }, [roomId, mediaInitialized]); // run once per room after media init

    // -------------------------
    // Auto-start transcription when connected
    // -------------------------
    useEffect(() => {
        if (isConnected && mediaInitialized && !isTranscribing) {
            console.log('[Session] Auto-starting transcription...');
            startTranscription();
        }
    }, [isConnected, mediaInitialized, isTranscribing, startTranscription]);

    // -------------------------
    // Auto-feature screen shares
    // -------------------------
    useEffect(() => {
        // Auto-select first screen share as featured
        if (!featuredTile) {
            if (screenSharers.size > 0) {
                const firstSharer = Array.from(screenSharers)[0];
                const participant = participants.find(p => p.userId === firstSharer);
                if (participant?.streams?.length) {
                    setFeaturedTile({ userId: firstSharer, streamId: participant.streams[0].id });
                    return;
                }
            }

            // Fallback: Default to first remote user with video
            const remoteWithVideo = participants.find(p => !p.isLocal && p.streams && p.streams.length > 0);
            if (remoteWithVideo && remoteWithVideo.streams) {
                setFeaturedTile({ userId: remoteWithVideo.userId, streamId: remoteWithVideo.streams[0].id });
                return;
            }

            // Fallback: Local user
            const local = participants.find(p => p.isLocal && p.streams && p.streams.length > 0);
            if (local && local.streams) {
                setFeaturedTile({ userId: local.userId, streamId: local.streams[0].id });
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
    // Push new transcripts to history
    // -------------------------
    // -------------------------
    // Push new transcripts to history
    // -------------------------
    // Replaced by onTranscript callback in useTranscription
    /*
    const prevTranscriptRef = useRef<string>('');
    useEffect(() => {
        if (transcript && transcript !== prevTranscriptRef.current) {
            // ... (old logic removed)
            prevTranscriptRef.current = transcript;
        }
    }, [transcript, participants]);
    */

    // -------------------------
    // Init Media on Mount
    // -------------------------
    useEffect(() => {
        enableUserMedia().finally(() => {
            setMediaInitialized(true);
            // Start transcription after media is ready
            startTranscription();
        });

        return () => {
            if (localMediaStreamRef.current) {
                localMediaStreamRef.current.getTracks().forEach(t => t.stop());
            }
            // Stop transcription on unmount
            stopTranscription();
            // Auto-save transcript to database when leaving session
            if (transcriptHistoryRef.current.length > 0) {
                // Use sendBeacon for reliable delivery during page unload
                const vtt = (() => {
                    let vtt = "WEBVTT\n\n";
                    transcriptHistoryRef.current.forEach((entry, index) => {
                        const formatTime = (seconds: number): string => {
                            const hrs = Math.floor(seconds / 3600);
                            const mins = Math.floor((seconds % 3600) / 60);
                            const secs = Math.floor(seconds % 60);
                            const ms = Math.floor((seconds % 1) * 1000);
                            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
                        };
                        vtt += `${index + 1}\n`;
                        vtt += `${formatTime(entry.startTime)} --> ${formatTime(entry.endTime)}\n`;
                        vtt += `${entry.text}\n\n`;
                    });
                    return vtt;
                })();

                const payload = JSON.stringify({
                    roomId,
                    content: vtt,
                    format: 'vtt'
                });

                // sendBeacon is reliable during page unload - uses /beacon endpoint (no auth)
                navigator.sendBeacon(
                    `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/transcripts/beacon`,
                    new Blob([payload], { type: 'application/json' })
                );
                console.log('[Session] Auto-saved transcript to database');
            }
        };
    }, []);

    // -------------------------
    // Detect mobile screen
    // -------------------------
    useEffect(() => {
        const isMob = screenSize.lessThan("md");
        setIsMobile(isMob);
    }, [screenSize]);

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
    // Fragmented Recording Control
    // -------------------------
    const handleFragmentedRecord = async () => {
        if (fragmentedRecorder.state.isRecording) {
            // Stop recording and timer
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
                recordingTimerRef.current = null;
            }

            await fragmentedRecorder.stopRecording();
            toast.success("Recording stopped. Uploading remaining fragments...");

            // Wait for uploads to complete
            await fragmentUploader.flushQueue();

            // Notify backend that recording is complete to trigger assembly
            const sessionId = fragmentedRecorder.state.sessionId;
            if (sessionId) {
                try {
                    const supabase = createClient();
                    const { data: { session } } = await supabase.auth.getSession();

                    await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}/api/upload/complete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${session?.access_token}`,
                        },
                        body: JSON.stringify({
                            sessionId,
                            roomName: `Room ${roomId}`,
                        }),
                    });
                    console.log(`[Recording] Triggered assembly for session ${sessionId}`);
                } catch (err) {
                    console.error('[Recording] Failed to trigger assembly:', err);
                }
            }

            toast.success(`Recording saved! ${fragmentedRecorder.state.fragmentCount} fragments uploaded.`);
            setRecordingTime(0);
        } else {
            // Start recording
            const stream = localMediaStreamRef.current;
            if (!stream) {
                toast.error("No media stream available");
                return;
            }

            const participantId = myUserIdRef.current;
            if (!participantId) {
                toast.error("User ID not available");
                return;
            }

            await fragmentedRecorder.startRecording(stream, roomId, participantId);
            toast.success("Recording started");

            // Start timer
            setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        }
    };

    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
        }
        // Ensure playback if paused (safeguard for mobile/lifecycle issues)
        if (el.paused || el.ended) {
            try { el.play().catch(() => { }); } catch (_) { }
        }
    };

    // -------------------------
    // UI render
    // -------------------------
    return (
        <ShaderBackground>
            <div className="absolute inset-0 z-10 pointer-events-none">
                <PixelTrail
                    pixelSize={screenSize.lessThan("md") ? 48 : 64}
                    fadeDuration={500}
                    delay={0}
                    pixelClassName="rounded-full bg-[#ea580c]/20"
                />
            </div>

            <div className="h-screen w-full flex flex-col overflow-hidden relative z-20" style={{ height: '100dvh', fontFamily: 'Supreme, sans-serif' }}>
                {/* Local preview (hidden small preview) */}
                <video ref={localPreviewRef} autoPlay muted playsInline className="hidden" />

                <div className="flex-1 flex overflow-hidden flex-col md:flex-row relative">
                    <div className="flex-1 p-4 sm:p-6 md:p-8 flex flex-col gap-6 relative">
                        {/* Main Featured View */}
                        <div className="flex-1 flex items-center justify-center bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] group/featured">
                            {featuredTile ? (
                                (() => {
                                    const participant = participants.find(p => p.userId === featuredTile.userId);
                                    const stream = participant?.streams?.find(s => s.id === featuredTile.streamId);

                                    if (participant && stream) {
                                        return (
                                            <div className="relative w-full h-full" key={`featured-${featuredTile.userId}-${featuredTile.streamId}`}>
                                                <video
                                                    key={`video-${featuredTile.streamId}`}
                                                    autoPlay
                                                    playsInline
                                                    muted={participant.isLocal}
                                                    ref={el => {
                                                        if (el && stream) {
                                                            el.srcObject = stream;
                                                            el.play().catch(() => { });
                                                        }
                                                    }}
                                                    className="w-full h-full object-contain transition-transform duration-700 group-hover/featured:scale-[1.01]"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/featured:opacity-100 transition-opacity duration-500" />
                                                <div className="absolute bottom-8 left-8 right-8 p-1 flex items-center gap-3">
                                                    <div className="px-6 py-2.5 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 shadow-2xl">
                                                        <span className="text-sm font-medium text-white/90 tracking-tight">
                                                            {participant.email || "Contributor"}
                                                            {screenSharers.has(participant.userId) && <span className="ml-2 text-[10px] uppercase tracking-widest text-[#ea580c] font-bold">Signal Live</span>}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center animate-pulse">
                                                <div className="w-2 h-2 rounded-full bg-[#ea580c]" />
                                            </div>
                                            <span className="text-[10px] uppercase tracking-[0.4em] text-white/20 font-light">Awaiting focus</span>
                                        </div>
                                    );
                                })()
                            ) : (
                                <div className="flex flex-col items-center gap-4 text-center">
                                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                                        <div className="w-8 h-8 rounded-full border border-[#ea580c]/50 animate-ping" />
                                        <div className="absolute w-2 h-2 rounded-full bg-[#ea580c]" />
                                    </div>
                                    <h3 className="text-xl font-light text-white/40 tracking-tight">
                                        {participants.length === 0 ? "Establishing uplink..." : "Select a signal to monitor"}
                                    </h3>
                                </div>
                            )}
                        </div>

                        {/* Real-time Transcription Overlay - Minimal startup style */}
                        <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute bottom-36 left-1/2 -translate-x-1/2 z-[35] w-full max-w-2xl px-8 pointer-events-none"
                        >
                            <div className="bg-black/60 backdrop-blur-3xl p-6 rounded-[2rem] border border-white/10 shadow-2xl transition-all duration-500 hover:border-[#ea580c]/30">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isTranscribing ? 'bg-[#ea580c] shadow-[0_0_12px_#ea580c]' : 'bg-white/20'}`} />
                                    <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/40">
                                        Intelligence Engine {isTranscribing ? "Active" : "Standby"}
                                    </span>
                                </div>

                                {isTranscribing && !transcript && (
                                    <div className="h-4 w-32 bg-white/5 rounded-full animate-pulse" />
                                )}
                                {transcript && (
                                    <p className="text-white text-base sm:text-lg leading-tight font-light tracking-tight animate-in fade-in slide-in-from-bottom-2">
                                        {transcript}
                                    </p>
                                )}
                            </div>
                        </motion.div>

                        {/* Thumbnails Strip - Highly refined */}
                        <div className="h-28 sm:h-32 md:h-40 flex gap-4 overflow-x-auto pb-6 px-1 scrollbar-hide">
                            <AnimatePresence mode="popLayout" initial={false}>
                                {participants.map(p => {
                                    if (p.streams && p.streams.length > 0) {
                                        return p.streams.map((s, idx) => {
                                            const isSelected = featuredTile?.userId === p.userId && featuredTile?.streamId === s.id;
                                            return (
                                                <motion.div
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    key={`${p.userId}-stream-${s.id}`}
                                                    onClick={() => setFeaturedTile({ userId: p.userId, streamId: s.id })}
                                                    className={`relative flex-shrink-0 w-40 sm:w-48 md:w-64 h-full bg-white/5 backdrop-blur-md rounded-[1.5rem] overflow-hidden cursor-pointer transition-all duration-500 overflow-hidden ${isSelected ? 'ring-2 ring-[#ea580c] scale-105 shadow-[0_20px_40px_-10px_rgba(234,88,12,0.3)]' : 'border border-white/10 hover:border-white/30'
                                                        }`}
                                                >
                                                    <video
                                                        autoPlay
                                                        playsInline
                                                        muted={p.isLocal}
                                                        ref={el => attachStreamToVideo(el, s)}
                                                        className={`w-full h-full object-cover opacity-60 transition-opacity duration-500 hover:opacity-100`}
                                                    />

                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

                                                    <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-white/90 tracking-tight truncate max-w-[120px]">
                                                                {p.email?.split('@')[0]}
                                                            </span>
                                                            <span className="text-[8px] uppercase tracking-widest text-[#ea580c] font-medium opacity-80">
                                                                {idx > 0 ? "Screen" : "Camera"}
                                                            </span>
                                                        </div>
                                                        <div className={`p-1.5 rounded-full ${p.isMuted ? 'bg-[#ea580c]' : 'bg-white/10'} backdrop-blur-md shadow-lg`}>
                                                            {p.isMuted ? <MicOff size={8} className="text-white" /> : <Mic size={8} className="text-white/60" />}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        });
                                    }

                                    return (
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            key={p.userId}
                                            className="relative flex-shrink-0 w-40 sm:w-48 md:w-64 h-full bg-white/5 backdrop-blur-md rounded-[1.5rem] border border-white/10 overflow-hidden cursor-pointer hover:bg-white/10 transition-all duration-500"
                                        >
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/5 flex items-center justify-center">
                                                    <span className="text-lg font-light text-white/20 tracking-widest uppercase">
                                                        {p.email?.slice(0, 2)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                                                <span className="text-[9px] uppercase tracking-widest font-bold text-white/40">{p.email?.split('@')[0]}</span>
                                                <div className={`p-1.5 rounded-full ${p.isMuted ? 'bg-[#ea580c]' : 'bg-white/10'} backdrop-blur-md`}>
                                                    {p.isMuted ? <MicOff size={8} className="text-white" /> : <Mic size={8} className="text-white/40" />}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Right Panel - Startup Style */}
                    <AnimatePresence>
                        {isPanelOpen && (
                            <motion.div
                                initial={{ x: "100%", opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                exit={{ x: "100%", opacity: 0 }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                                className={`fixed md:relative inset-0 md:inset-auto z-50 md:z-auto w-full md:w-[420px] h-full flex flex-col border-l border-white/10 bg-black/40 backdrop-blur-3xl shadow-[-30px_0_80px_rgba(0,0,0,0.8)]`}
                            >
                                <div className="flex-1 flex flex-col p-8 sm:p-10 min-h-0">
                                    <div className="flex items-center justify-between mb-10">
                                        <h2 className="text-2xl font-light tracking-tight text-white/90">Studio Panel</h2>
                                        <button onClick={() => setIsPanelOpen(false)} className="p-2.5 rounded-full hover:bg-white/10 transition-all duration-300">
                                            <X size={18} className="text-white/40 hover:text-white" />
                                        </button>
                                    </div>

                                    {isMobile ? (
                                        <div className="flex-1 flex flex-col w-full overflow-hidden min-h-0">
                                            <div className="flex-none flex items-center justify-between mb-4">
                                                <h2 className="text-white/40 text-xs uppercase tracking-widest font-semibold">Live Chat</h2>
                                                <span className="text-white/20 text-[10px] tracking-widest">{participants.length} CONNS</span>
                                            </div>

                                            <div
                                                className="flex-1 overflow-y-auto min-h-0 space-y-6 pr-2 pb-4 touch-pan-y scrollbar-hide"
                                                ref={chatScrollRef}
                                                style={{ WebkitOverflowScrolling: 'touch' }}
                                            >
                                                {chatMessages.length === 0 && (
                                                    <div className="text-white/10 text-[10px] uppercase tracking-widest text-center mt-10">No broadcast data</div>
                                                )}
                                                {chatMessages.map((msg, idx) => (
                                                    <div key={idx} className="flex flex-col gap-2">
                                                        <div className="flex items-baseline justify-between">
                                                            <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">{msg.email?.split('@')[0]}</span>
                                                            <span className="text-[8px] tracking-widest text-white/20">
                                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm font-light text-white/90 break-words leading-relaxed">{msg.text}</div>
                                                    </div>
                                                ))}
                                            </div>

                                            <form onSubmit={handleSendMessage} className="flex-none mt-6 flex gap-3 w-full pb-2">
                                                <input
                                                    value={chatInput}
                                                    onChange={(e) => setChatInput(e.target.value)}
                                                    type="text"
                                                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-4 text-sm text-white focus:outline-none focus:border-[#ea580c]/50 transition-all placeholder:text-white/20"
                                                    placeholder="Encrypt signal..."
                                                />
                                                <button type="submit" disabled={!chatInput.trim()} className="bg-white text-black w-12 h-12 rounded-full flex items-center justify-center hover:bg-[#ea580c] hover:text-white transition-all disabled:opacity-50">
                                                    <ArrowRight size={20} />
                                                </button>
                                            </form>
                                        </div>
                                    ) : (
                                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
                                            <TabsList className="bg-white/5 border border-white/10 p-1 rounded-full mb-8">
                                                <TabsTrigger value="transcript" className="rounded-full text-[10px] uppercase tracking-widest font-medium data-[state=active]:bg-white data-[state=active]:text-black text-white/40 transition-all">Transcript</TabsTrigger>
                                                <TabsTrigger value="chat" className="rounded-full text-[10px] uppercase tracking-widest font-medium data-[state=active]:bg-white data-[state=active]:text-black text-white/40 transition-all">Chat</TabsTrigger>
                                                <TabsTrigger value="whiteboard" className="rounded-full text-[10px] uppercase tracking-widest font-medium data-[state=active]:bg-white data-[state=active]:text-black text-white/40 transition-all">Annotate</TabsTrigger>
                                                <TabsTrigger value="attendance" className="rounded-full text-[10px] uppercase tracking-widest font-medium data-[state=active]:bg-white data-[state=active]:text-black text-white/40 transition-all">Users</TabsTrigger>
                                            </TabsList>

                                            <div className="flex-1 min-h-0">
                                                <TabsContent value="whiteboard" className="h-full mt-0 overflow-hidden outline-none">
                                                    <AnnotationBoard />
                                                </TabsContent>

                                                <TabsContent value="attendance" className="h-full mt-0 overflow-y-auto pr-2 outline-none scrollbar-hide">
                                                    <div className="space-y-6">
                                                        {participants.map((p, idx) => (
                                                            <div key={p.userId} className="group relative bg-white/5 border border-white/5 rounded-2xl p-5 transition-all duration-300 hover:bg-white/10">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 group-hover:border-[#ea580c] transition-colors">
                                                                            <span className="text-xs font-light text-white/40 uppercase tracking-widest">{p.email?.slice(0, 2)}</span>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-sm font-medium text-white/90 tracking-tight">{p.email?.split('@')[0]}</span>
                                                                            <span className="text-[10px] uppercase tracking-widest text-white/20">{p.isLocal ? "Source Admin" : "Connected"}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className={`p-1.5 rounded-full ${p.isMuted ? 'text-[#ea580c]' : 'text-white/20'}`}>
                                                                        {p.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                                                                    </div>
                                                                </div>
                                                                <div className="h-0.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                                    <motion.div
                                                                        initial={{ width: 0 }}
                                                                        animate={{ width: '100%' }}
                                                                        className="h-full bg-[#ea580c]/40"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </TabsContent>

                                                <TabsContent value="chat" className="h-full mt-0 flex flex-col outline-none">
                                                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 pb-4 scrollbar-hide" ref={chatScrollRef}>
                                                        {chatMessages.length === 0 && (
                                                            <div className="text-white/10 text-[10px] uppercase tracking-widest text-center mt-20">No broadcast data</div>
                                                        )}
                                                        <AnimatePresence initial={false}>
                                                            {chatMessages.map((msg, idx) => (
                                                                <motion.div
                                                                    key={idx}
                                                                    initial={{ opacity: 0, x: 20 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    className="flex flex-col gap-2"
                                                                >
                                                                    <div className="flex items-baseline justify-between transition-all">
                                                                        <span className="text-[10px] uppercase tracking-widest font-bold text-white/50">{msg.email?.split('@')[0]}</span>
                                                                        <span className="text-[8px] tracking-widest text-white/20">
                                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </div>
                                                                    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 text-sm font-light text-white/90 leading-relaxed hover:bg-white/10 transition-colors">{msg.text}</div>
                                                                </motion.div>
                                                            ))}
                                                        </AnimatePresence>
                                                    </div>

                                                    <form onSubmit={handleSendMessage} className="mt-6 flex gap-3">
                                                        <input
                                                            value={chatInput}
                                                            onChange={(e) => setChatInput(e.target.value)}
                                                            type="text"
                                                            className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-4 text-sm text-white focus:outline-none focus:border-[#ea580c]/50 transition-all"
                                                            placeholder="Broadcast signal..."
                                                        />
                                                        <button type="submit" disabled={!chatInput.trim()} className="bg-white text-black w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center hover:bg-[#ea580c] hover:text-white transition-all disabled:opacity-30">
                                                            <ArrowRight size={20} />
                                                        </button>
                                                    </form>
                                                </TabsContent>

                                                <TabsContent value="transcript" className="h-full mt-0 flex flex-col outline-none">
                                                    <div className="flex items-center justify-between mb-8 flex-shrink-0">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${isTranscribing ? 'bg-[#ea580c] shadow-[0_0_8px_#ea580c]' : 'bg-yellow-500'} animate-pulse`} />
                                                            <span className="text-[10px] uppercase tracking-widest font-medium text-white/60">
                                                                {isTranscribing ? "Voice Intel" : "Standby"}
                                                            </span>
                                                        </div>
                                                        {transcriptHistory.length > 0 && (
                                                            <div className="flex gap-2">
                                                                <button onClick={downloadVTT} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/10">
                                                                    <ArrowRight size={14} className="rotate-90" />
                                                                </button>
                                                                <button onClick={() => saveTranscriptToDatabase()} className="px-5 py-2 bg-white text-black text-[10px] uppercase font-bold tracking-widest rounded-full hover:bg-[#ea580c] hover:text-white transition-all">
                                                                    Store
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto space-y-6 pr-2 pb-4 scrollbar-hide" ref={transcriptScrollRef}>
                                                        {transcriptHistory.length === 0 && (
                                                            <div className="text-white/10 text-[10px] uppercase tracking-widest text-center mt-20">Awaiting audio uplink...</div>
                                                        )}
                                                        <AnimatePresence initial={false}>
                                                            {transcriptHistory.map((entry, idx) => (
                                                                <motion.div
                                                                    key={idx}
                                                                    initial={{ opacity: 0, y: 10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                >
                                                                    <div className="group/entry flex flex-col gap-2">
                                                                        <div className="flex items-baseline justify-between opacity-40 group-hover/entry:opacity-100 transition-opacity">
                                                                            <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">{entry.speaker}</span>
                                                                            <span className="text-[8px] tracking-widest text-white/30">
                                                                                {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                        </div>
                                                                        <div className="bg-white/5 border border-white/5 rounded-[2rem] p-5 text-sm font-light text-white/70 leading-relaxed italic hover:bg-white/10 transition-colors">
                                                                            <span className="text-[#ea580c] mr-2 opacity-50">"</span>
                                                                            {entry.text}
                                                                            <span className="text-[#ea580c] ml-2 opacity-50">"</span>
                                                                        </div>
                                                                    </div>
                                                                </motion.div>
                                                            ))}
                                                        </AnimatePresence>
                                                    </div>
                                                </TabsContent>
                                            </div>
                                        </Tabs>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Floating control bar - Modern Startup Pill */}
                <motion.div
                    initial={{ y: 80, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 1, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40"
                >
                    <div className="bg-black/60 backdrop-blur-3xl border border-white/15 rounded-full px-4 py-3 sm:px-8 sm:py-5 shadow-[0_40px_100px_rgba(0,0,0,0.8)] flex items-center gap-2 sm:gap-6 group/controls">
                        <button
                            onClick={toggleMic}
                            className={`group relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${isMuted ? 'bg-[#ea580c] text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]' : 'bg-white/5 text-white/50 hover:bg-white/15 hover:text-white border border-white/10'}`}
                        >
                            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                            <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-[8px] uppercase tracking-widest text-white/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Audio</span>
                        </button>

                        <button
                            onClick={toggleCamera}
                            className={`group relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${isVideoOff ? 'bg-[#ea580c] text-white shadow-[0_0_20px_rgba(234,88,12,0.4)]' : 'bg-white/5 text-white/50 hover:bg-white/15 hover:text-white border border-white/10'}`}
                        >
                            {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                            <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-[8px] uppercase tracking-widest text-white/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Visual</span>
                        </button>

                        <button
                            onClick={handleScreenShare}
                            className={`group relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${localScreenRef.current ? 'bg-[#ea580c] text-white' : 'bg-white/5 text-white/50 hover:bg-white/15 hover:text-white border border-white/10'}`}
                        >
                            <MonitorUp size={18} />
                            <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-[8px] uppercase tracking-widest text-white/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">Transmit</span>
                        </button>

                        <div className="w-px h-10 bg-white/10 mx-2" />

                        <button
                            onClick={handleFragmentedRecord}
                            className={`group relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${fragmentedRecorder.state.isRecording ? 'bg-red-500 text-white animate-pulse shadow-[0_0_30px_rgba(239,68,68,0.5)]' : 'bg-white/5 text-white/50 hover:bg-white/15 hover:text-white border border-white/10'}`}
                        >
                            <Circle size={18} className={fragmentedRecorder.state.isRecording ? 'fill-current' : ''} />
                            {fragmentedRecorder.state.isRecording && (
                                <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-red-500 px-4 py-1.5 rounded-full shadow-2xl">
                                    <span className="text-[10px] font-bold tracking-[0.2em] text-white uppercase">{formatTime(recordingTime)}</span>
                                </div>
                            )}
                            {!fragmentedRecorder.state.isRecording && (
                                <span className="absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1 bg-black text-[8px] uppercase tracking-widest text-white/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Archives</span>
                            )}
                        </button>

                        <button className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-[#ea580c] hover:text-white transition-all duration-500 shadow-[0_10px_40px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95">
                            <PhoneOff size={18} className="rotate-[135deg]" />
                        </button>

                        {!isPanelOpen && (
                            <button onClick={() => setIsPanelOpen(true)} className="w-12 h-12 rounded-full bg-white/5 text-white/40 hover:text-white hover:bg-white/15 border border-white/10 flex items-center justify-center transition-all duration-500">
                                <Menu size={18} />
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </ShaderBackground>
    );
}
