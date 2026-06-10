// Plain Node environment access (no Cloudflare bindings in the self-hosted
// build). Values come from process.env, populated by .env / docker-compose.

export function getEnv() {
  return {
    DATABASE_PATH: process.env.DATABASE_PATH || "./data/app.db",
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET || "dev-only-secret-change-me",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    VOICEBOT_API_URL: process.env.VOICEBOT_API_URL || "http://voicebot:8766",
    VOICEBOT_WS_URL: process.env.VOICEBOT_WS_URL || "ws://localhost:8765",
  };
}
