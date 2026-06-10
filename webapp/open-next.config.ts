import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default Cloudflare adapter config. No KV/R2 incremental cache for the
// prototype, so no extra OpenNext Durable Objects are needed.
export default defineCloudflareConfig({});
