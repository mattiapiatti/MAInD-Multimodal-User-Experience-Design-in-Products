import { getBackendDO } from "@/lib/env";

// Better Auth lives in the Durable Object. Forward every /api/auth/* request to
// it. We rebuild a clean, standard Request (absolute URL + buffered body) so the
// DO stub.fetch gets a plain serializable object across the RPC boundary.
async function handle(request) {
  const do_ = await getBackendDO();
  const init = { method: request.method, headers: request.headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }
  return do_.fetch(new Request(request.url, init));
}

export const GET = handle;
export const POST = handle;
