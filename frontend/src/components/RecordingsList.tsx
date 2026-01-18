"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Play, Download, Trash2, Loader2, Film } from "lucide-react";

interface Recording {
    sessionId: string;
    roomId: string;
    createdAt: string;
    fragmentCount: number;
    previewUrl?: string;
    status: string;
}

export function RecordingsList() {
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedRecording, setSelectedRecording] = useState<string | null>(null);

    const supabase = createClient();
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

    useEffect(() => {
        fetchRecordings();
    }, []);

    const fetchRecordings = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setError("Not authenticated");
                return;
            }

            const response = await fetch(`${backendUrl}/api/recordings`, {
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (!response.ok) {
                throw new Error("Failed to fetch recordings");
            }

            const data = await response.json();
            setRecordings(data.recordings || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load recordings");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (sessionId: string) => {
        if (!confirm("Are you sure you want to delete this recording?")) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) return;

            const response = await fetch(`${backendUrl}/api/recordings/${sessionId}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });

            if (response.ok) {
                setRecordings(prev => prev.filter(r => r.sessionId !== sessionId));
            }
        } catch (err) {
            console.error("Delete failed:", err);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-red-400 text-sm">{error}</p>
                <button onClick={fetchRecordings} className="mt-2 text-white/60 hover:text-white text-sm">
                    Try again
                </button>
            </div>
        );
    }

    if (recordings.length === 0) {
        return (
            <div className="text-center py-12">
                <Film className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/40 text-sm">No recordings yet</p>
                <p className="text-white/20 text-xs mt-1">Start a session and click record to save your first recording</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Your Recordings</h3>

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {recordings.map((recording) => (
                    <div
                        key={recording.sessionId}
                        className="group bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all"
                    >
                        {/* Preview */}
                        <div className="aspect-video bg-black/40 relative flex items-center justify-center">
                            {recording.previewUrl ? (
                                <video
                                    src={recording.previewUrl}
                                    className="w-full h-full object-cover"
                                    muted
                                    onMouseEnter={(e) => e.currentTarget.play()}
                                    onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                />
                            ) : (
                                <Film className="w-12 h-12 text-white/10" />
                            )}

                            {/* Play overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Play className="w-12 h-12 text-white" />
                            </div>
                        </div>

                        {/* Info */}
                        <div className="p-4">
                            <p className="text-sm text-white/80 font-medium truncate">
                                Session {recording.sessionId.split('_').slice(0, 2).join('_')}
                            </p>
                            <p className="text-xs text-white/40 mt-1">
                                {formatDate(recording.createdAt)} • {recording.fragmentCount} segments
                            </p>

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    onClick={() => setSelectedRecording(recording.sessionId)}
                                    className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 hover:text-white transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Download
                                </button>
                                <button
                                    onClick={() => handleDelete(recording.sessionId)}
                                    className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-xs text-red-400 hover:text-red-300 transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
