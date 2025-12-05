const RoomStore = require("../store/roomStore");

module.exports = function registerChatHandlers(io, socket) {

    // -------------------------------
    // SEND CHAT HISTORY ON JOIN
    // -------------------------------
    socket.on("request-chat-history", ({ roomId }) => {
        if (!roomId) return;

        const history = RoomStore.getMessages(roomId);

        socket.emit("chat-history", history);
    });

    // -------------------------------
    // SEND MESSAGE
    // -------------------------------
    socket.on("send-message", ({ roomId, text }) => {
        if (!roomId || !text || text.trim() === "") return;

        const message = {
            userId: socket.user.id,
            email: socket.user.email,
            text,
            timestamp: Date.now()
        };

        // Save to store
        RoomStore.addMessage(roomId, message);

        // Broadcast to everyone (including sender)
        io.to(roomId).emit("receive-message", message);
    });
};
