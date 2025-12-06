module.exports = function registerSignalingHandlers(io, socket) {
    // -------------------------------
    // WEBRTC SIGNALING
    // -------------------------------

    // Forward Offer
    socket.on("webrtc-offer", ({ roomId, targetUserId, offer }) => {
        console.log(`[${socket.id}] webrtc-offer from ${socket.user.email} to ${targetUserId}`);
        if (!roomId || !targetUserId || !offer) return;

        // Emit to the specific target user
        // We need to find the socket ID for the target user.
        // Since we don't have a direct map here, we can broadcast to the room
        // but it's better to send to specific socket if possible.
        // However, our client listens for "webrtc-offer" and checks "targetUserId" if we broadcast?
        // Actually, the client code says:
        // s.on("webrtc-offer", async ({ fromUserId, offer }: any) => { ... })
        // It doesn't seem to check targetUserId on the receiving end in the snippet I saw?
        // Wait, let me check the client code again.

        // Client code:
        // s.on("webrtc-offer", async ({ fromUserId, offer }: any) => {
        //    // received an offer (someone initiated to us)
        //    const pc = createPeerConnection(fromUserId);
        //    ...
        // });

        // The client code DOES NOT check if the offer is meant for them.
        // So we MUST send it ONLY to the target user's socket.

        // We can use io.in(roomId).fetchSockets() to find the target, or just emit to room with a "targetUserId" field
        // and update client to check it.
        // BUT, the client code I saw earlier:
        /*
            s.on("webrtc-offer", async ({ fromUserId, offer }: any) => {
                // received an offer (someone initiated to us)
                // create PC for that user and respond with answer
                const pc = createPeerConnection(fromUserId);
                ...
            });
        */
        // It seems the client assumes if it receives an event, it's for them.
        // So I should try to send to the specific socket ID.
        // In `room.js`, we have `RoomStore`. Let's use that if available, or just broadcast to room
        // and rely on the fact that we can send `to(socketId)`.

        // Wait, `RoomStore` has the mapping!
        // But `registerSignalingHandlers` is in a separate file. I should import RoomStore.

        const RoomStore = require("../store/roomStore");
        const targetUser = RoomStore.getUsers(roomId).find(u => u.userId === targetUserId);

        if (targetUser && targetUser.socketId) {
            io.to(targetUser.socketId).emit("webrtc-offer", {
                fromUserId: socket.user.id,
                offer
            });
        } else {
            console.warn(`Target user ${targetUserId} not found in room ${roomId}`);
        }
    });

    // Forward Answer
    socket.on("webrtc-answer", ({ roomId, targetUserId, answer }) => {
        console.log(`[${socket.id}] webrtc-answer from ${socket.user.email} to ${targetUserId}`);
        if (!roomId || !targetUserId || !answer) return;

        const RoomStore = require("../store/roomStore");
        const targetUser = RoomStore.getUsers(roomId).find(u => u.userId === targetUserId);

        if (targetUser && targetUser.socketId) {
            io.to(targetUser.socketId).emit("webrtc-answer", {
                fromUserId: socket.user.id,
                answer
            });
        }
    });

    // Forward ICE Candidate
    socket.on("webrtc-ice-candidate", ({ roomId, targetUserId, candidate }) => {
        // console.log(`[${socket.id}] ICE candidate from ${socket.user.email} to ${targetUserId}`);
        if (!roomId || !targetUserId || !candidate) return;

        const RoomStore = require("../store/roomStore");
        const targetUser = RoomStore.getUsers(roomId).find(u => u.userId === targetUserId);

        if (targetUser && targetUser.socketId) {
            io.to(targetUser.socketId).emit("webrtc-ice-candidate", {
                fromUserId: socket.user.id,
                candidate
            });
        }
    });
};
