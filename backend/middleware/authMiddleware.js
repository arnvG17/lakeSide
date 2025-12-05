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

const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: "Missing Authorization header" });
        }

        if (!authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ error: "Invalid Authorization header format" });
        }

        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({ error: "Missing access token" });
        }

        const { data, error } = await supabaseAdmin.auth.getUser(token);

        if (error || !data?.user) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }

        // Attach the verified user
        req.user = data.user;

        next();

    } catch (error) {
        console.error('[AUTH MIDDLEWARE ERROR]', error);
        return res.status(500).json({ error: 'Internal server error during authentication' });
    }
};

module.exports = authenticateUser;
