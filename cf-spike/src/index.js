import { AuthDO } from "./auth-do.js";

export { AuthDO };

// Singleton "main" auth DO holds all accounts/sessions for the spike. The Worker
// is a thin router: forward auth requests to the DO; everything else is a probe.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/auth")) {
      const stub = env.AUTH_DO.getByName("main");
      return stub.fetch(request);
    }

    if (url.pathname === "/whoami") {
      const stub = env.AUTH_DO.getByName("main");
      const session = await stub.getSession(
        Object.fromEntries(request.headers),
      );
      return Response.json({ session });
    }

    return new Response(
      "cf-spike up. Try POST /api/auth/sign-up/email, /api/auth/sign-in/email, GET /whoami\n",
      { headers: { "content-type": "text/plain" } },
    );
  },
};
