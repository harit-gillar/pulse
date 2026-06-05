// Server-only env vars. Never import this from client components — these are
// not prefixed NEXT_PUBLIC and are stripped from the browser bundle.
export const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
export const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const hasGoogleOAuth = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
export const hasServiceRole = Boolean(SUPABASE_SERVICE_ROLE_KEY);
