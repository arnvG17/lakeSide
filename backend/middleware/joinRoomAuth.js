const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
    }
);

const joinRoomAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // Get the current path for redirect
        const currentPath = req.originalUrl || req.path;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            // Redirect to login with the current path as redirect parameter
            const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
            return res.redirect(loginUrl);
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
            return res.redirect(loginUrl);
        }

        const { data, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !data?.user) {
            const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
            return res.redirect(loginUrl);
        }

        // Attach the verified user
        req.user = data.user;

        // Optionally verify room access here if needed
        // const { roomId } = req.params;
        // Add room-specific authorization logic

        next();

    } catch (error) {
        console.error('[JOIN ROOM AUTH ERROR]', error);
        const currentPath = req.originalUrl || req.path;
        const loginUrl = `/login?redirect=${encodeURIComponent(currentPath)}`;
        return res.redirect(loginUrl);
    }
};

module.exports = { joinRoomAuth, supabaseAdmin };
