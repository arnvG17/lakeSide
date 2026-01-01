const rooms = {};   // { roomId: { users: {}, chat: [] } }

const RoomStore = {

    addUser(roomId, user) {
        if (!rooms[roomId]) {
            rooms[roomId] = {
                users: {},
                chat: [],
                screenSharer: null,
            };
        }

        rooms[roomId].users[user.userId] = user;

        return Object.values(rooms[roomId].users);
    },

    removeUser(roomId, userId) {
        if (!rooms[roomId]) return;

        delete rooms[roomId].users[userId];

        if (Object.keys(rooms[roomId].users).length === 0) {
            delete rooms[roomId];
        }
    },

    updateUser(roomId, userId, partialState) {
        if (!rooms[roomId] || !rooms[roomId].users[userId]) return null;

        rooms[roomId].users[userId].userState = {
            ...rooms[roomId].users[userId].userState,
            ...partialState,
        };

        return rooms[roomId].users[userId];
    },

    getUsers(roomId) {
        return rooms[roomId] ? Object.values(rooms[roomId].users) : [];
    },

    // 🔥 NEW: STORE CHAT MESSAGE
    addMessage(roomId, message) {
        if (!rooms[roomId]) {
            rooms[roomId] = { users: {}, chat: [] };
        }

        rooms[roomId].chat.push(message);

        return message;
    },

    // 🔥 NEW GET CHAT HISTORY
    getMessages(roomId) {
        return rooms[roomId] ? rooms[roomId].chat : [];
    },

    // 🔥 NEW: SET SCREEN SHARER (Multiple)

    addScreenSharer(roomId, userId) {
        if (!rooms[roomId]) return null;
        if (!rooms[roomId].screenSharers) {
            rooms[roomId].screenSharers = new Set();
        }
        rooms[roomId].screenSharers.add(userId);
        return Array.from(rooms[roomId].screenSharers);
    },

    removeScreenSharer(roomId, userId) {
        if (!rooms[roomId] || !rooms[roomId].screenSharers) return null;
        rooms[roomId].screenSharers.delete(userId);
        return Array.from(rooms[roomId].screenSharers);
    },

    getScreenSharers(roomId) {
        return rooms[roomId]?.screenSharers ? Array.from(rooms[roomId].screenSharers) : [];
    },

    // Transcript storage for persistence across reloads
    addTranscript(roomId, transcript) {
        if (!rooms[roomId]) {
            rooms[roomId] = { users: {}, chat: [], transcripts: [] };
        }
        if (!rooms[roomId].transcripts) {
            rooms[roomId].transcripts = [];
        }
        rooms[roomId].transcripts.push(transcript);

        // Keep only last 500 transcripts per room to prevent memory issues
        if (rooms[roomId].transcripts.length > 500) {
            rooms[roomId].transcripts = rooms[roomId].transcripts.slice(-500);
        }

        return transcript;
    },

    getTranscripts(roomId) {
        return rooms[roomId]?.transcripts || [];
    },

    clearTranscripts(roomId) {
        if (rooms[roomId]) {
            rooms[roomId].transcripts = [];
        }
    }

};





module.exports = RoomStore;
