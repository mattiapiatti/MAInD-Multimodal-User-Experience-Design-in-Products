import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

const handler = toNextJsHandler(getAuth());

export const POST = handler.POST;
export const GET = handler.GET;
