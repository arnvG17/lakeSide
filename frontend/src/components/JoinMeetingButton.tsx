"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function JoinMeetingButton() {
    const [open, setOpen] = useState(false);
    const [meetingLink, setMeetingLink] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleJoinMeeting = () => {
        setError("");

        if (!meetingLink.trim()) {
            setError("Please enter a meeting link");
            return;
        }

        // Extract room ID from the link
        // Expected format: http://localhost:3000/room/[roomId] or just the roomId
        let roomId = "";

        try {
            // Try to parse as URL
            if (meetingLink.includes("/room/")) {
                const parts = meetingLink.split("/room/");
                roomId = parts[1]?.split("?")[0]?.split("#")[0] || "";
            } else {
                // Assume it's just the room ID
                roomId = meetingLink.trim();
            }

            if (!roomId) {
                setError("Invalid meeting link format");
                return;
            }

            // Navigate to the room
            router.push(`/room/${roomId}`);
            setOpen(false);
            setMeetingLink("");
        } catch (err) {
            setError("Invalid meeting link");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button className="px-6 py-3 bg-white/10 backdrop-blur-md shadow-xl hover:bg-white/20 hover:shadow-2xl hover:scale-105 active:scale-95 text-white text-sm font-medium tracking-wide rounded-full transition-all duration-300 flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Join Meeting
                </button>
            </DialogTrigger>
            <DialogContent className="bg-black border border-white/20 text-white">
                <DialogHeader>
                    <DialogTitle className="text-xl font-light tracking-wide">Join a Meeting</DialogTitle>
                    <DialogDescription className="text-white/60 text-sm">
                        Paste the meeting link or room ID below to join
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                    <div>
                        <input
                            type="text"
                            placeholder="Paste meeting link or room ID"
                            value={meetingLink}
                            onChange={(e) => {
                                setMeetingLink(e.target.value);
                                setError("");
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleJoinMeeting();
                                }
                            }}
                            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 transition-colors"
                        />
                        {error && (
                            <p className="text-red-400 text-xs mt-2">{error}</p>
                        )}
                    </div>
                    <div className="flex gap-3 justify-end">
                        <button
                            onClick={() => {
                                setOpen(false);
                                setMeetingLink("");
                                setError("");
                            }}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-full transition-all duration-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleJoinMeeting}
                            className="px-4 py-2 bg-white text-black hover:bg-white/90 text-sm font-medium rounded-full transition-all duration-300"
                        >
                            Join
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
