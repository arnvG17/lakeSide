import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";

    if (!code) {
        return NextResponse.redirect(`${origin}/auth/error`);
    }

    // 1️⃣ Exchange code for a Supabase session
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data?.session) {
        console.error("OAuth exchange error:", error);
        return NextResponse.redirect(`${origin}/auth/error`);
    }

    const session = data.session;
    const user = data.user;
    const token = session.access_token; // IMPORTANT

    // 2️⃣ Log login event (does NOT need token)
    try {
        await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"}/api/auth/log-login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                userId: user.id,
                email: user.email,
                timestamp: new Date().toISOString(),
            }),
        });
    } catch (err) {
        console.error("Failed to log login:", err);
    }

    // 3️⃣ Securely sync user to backend DB (USES TOKEN)
    try {
        await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"}/api/auth/sync-user`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
    } catch (err) {
        console.error("Failed to sync user:", err);
    }

    // 4️⃣ Handle redirect
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocal = process.env.NODE_ENV === "development";

    if (isLocal) {
        return NextResponse.redirect(`${origin}${next}`);
    } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
    } else {
        return NextResponse.redirect(`${origin}${next}`);
    }
}
