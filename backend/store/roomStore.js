const rooms = {};   // { roomId: { users: {}, chat: [] } }

const RoomStore = {

    addUser(roomId, user) {
        if (!rooms[roomId]) {
            rooms[roomId] = {
                users: {},
                chat: []
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

    // 🔥 NEW: GET CHAT HISTORY
    getMessages(roomId) {
        return rooms[roomId] ? rooms[roomId].chat : [];
    }
};

module.exports = RoomStore;
