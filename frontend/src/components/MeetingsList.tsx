"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Video, ArrowRight } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface Meeting {
    id: string;
    roomName: string;
    createdAt: string;
}

interface Recording {
    id: string;
    name: string;
    videoUrl?: string;
    roomId?: string;
}

interface MeetingsListProps {
    meetings: Meeting[];
    recordings: Recording[];
}

export function MeetingsList({ meetings, recordings }: MeetingsListProps) {
    const router = useRouter();
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    const handleCardClick = (meeting: Meeting) => {
        setSelectedMeeting(meeting);
        setIsOpen(true);
    };

    const handleResumeMeeting = () => {
        if (selectedMeeting) {
            router.push(`/room/${selectedMeeting.id}`);
        }
    };

    // Find recording for the selected meeting (if any)
    const getRecordingForMeeting = (meetingId: string) => {
        return recordings.find((r) => r.roomId === meetingId);
    };

    const selectedRecording = selectedMeeting
        ? getRecordingForMeeting(selectedMeeting.id)
        : null;

    if (meetings.length === 0) {
        return (
            <div className="col-span-full border border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center min-h-[150px]">
                <p className="text-sm text-white/40">No meeting history found</p>
            </div>
        );
    }

    return (
        <>
            {meetings.map((meeting) => (
                <div
                    key={meeting.id}
                    onClick={() => handleCardClick(meeting)}
                    className="group bg-white/[0.02] border border-white/10 rounded-2xl p-6 hover:bg-white/[0.04] hover:border-white/20 transition-all duration-300 cursor-pointer"
                >
                    <h3 className="text-lg font-light mb-1">
                        {meeting.roomName || "Untitled Meeting"}
                    </h3>
                    <p className="text-xs text-white/40">
                        {meeting.createdAt
                            ? new Date(meeting.createdAt).toLocaleDateString()
                            : "Unknown Date"}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-white/30 group-hover:text-white/60 transition-colors">
                        <span className="text-xs">Click to view options</span>
                        <ArrowRight className="w-3 h-3" />
                    </div>
                </div>
            ))}

            {/* Room Details Modal */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="bg-black border-white/10 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-light">
                            {selectedMeeting?.roomName || "Untitled Meeting"}
                        </DialogTitle>
                        <DialogDescription className="text-white/40">
                            Created on{" "}
                            {selectedMeeting?.createdAt
                                ? new Date(selectedMeeting.createdAt).toLocaleDateString("en-US", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })
                                : "Unknown Date"}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Recording Section */}
                        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <div className="flex items-center gap-3 mb-3">
                                <Video className="w-5 h-5 text-white/60" />
                                <span className="text-sm font-medium">Recording</span>
                            </div>
                            {selectedRecording ? (
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-white/60">
                                        {selectedRecording.name}
                                    </span>
                                    <button
                                        onClick={() => {
                                            if (selectedRecording.videoUrl) {
                                                window.open(selectedRecording.videoUrl, "_blank");
                                            }
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors"
                                    >
                                        <Play className="w-4 h-4" />
                                        Watch
                                    </button>
                                </div>
                            ) : (
                                <p className="text-sm text-white/40 italic">
                                    No recording available for this session
                                </p>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="gap-3">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
                        >
                            Close
                        </button>
                        <button
                            onClick={handleResumeMeeting}
                            className="flex items-center gap-2 px-6 py-2 bg-white text-black rounded-full text-sm font-medium hover:bg-white/90 transition-colors"
                        >
                            Resume Meeting
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
