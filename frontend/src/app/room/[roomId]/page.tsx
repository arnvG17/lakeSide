"use client";

import SessionRoom from "@/components/pages/Session-ui";
import { use } from "react";

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);
    return <SessionRoom roomId={roomId} />;
}
