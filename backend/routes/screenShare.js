const RoomStore = require("../store/roomStore");

module.exports = function registerScreenShareHandlers(io, socket) {

    // -------------------------------
    // START SCREEN SHARE
    // -------------------------------
    socket.on("start-screen-share", ({ roomId }) => {
        console.log(`[${socket.id}] start-screen-share request for room ${roomId}`);
        if (!roomId) return;

        // Set sharer (add to set)
        RoomStore.addScreenSharer(roomId, socket.user.id);
        console.log(`Added sharer ${socket.user.id} for room ${roomId}`);

        // Notify everyone in the room
        io.to(roomId).emit("screen-share-started", {
            userId: socket.user.id,
            email: socket.user.email
        });
        console.log("Broadcasted screen-share-started");
    });

    // -------------------------------
    // STOP SCREEN SHARE
    // -------------------------------
    socket.on("stop-screen-share", ({ roomId }) => {
        console.log(`[${socket.id}] stop-screen-share request for room ${roomId}`);
        if (!roomId) return;

        const sharers = RoomStore.getScreenSharers(roomId);
        if (!sharers.includes(socket.user.id)) {
            console.log("Ignored: Requestor is not sharing");
            return;
        }

        RoomStore.removeScreenSharer(roomId, socket.user.id);
        console.log(`Removed sharer ${socket.user.id} from room ${roomId}`);

        io.to(roomId).emit("screen-share-stopped", {
            userId: socket.user.id
        });
        console.log("Broadcasted screen-share-stopped");
    });

    // -------------------------------
    // CLEAN UP ON DISCONNECT
    // -------------------------------
    socket.on("disconnect", () => {
        const roomId = socket.roomId;
        if (!roomId) return;

        const sharers = RoomStore.getScreenSharers(roomId);
        if (sharers.includes(socket.user.id)) {
            console.log(`Sharer ${socket.user.id} disconnected from room ${roomId}`);
            // Remove sharer on disconnect
            RoomStore.removeScreenSharer(roomId, socket.user.id);

            io.to(roomId).emit("screen-share-stopped", {
                userId: socket.user.id
            });
            console.log("Broadcasted screen-share-stopped (disconnect)");
        }
    });
};
