import { auth } from "@/auth";
import { dispatchIntelligenceAction } from "./remote.js";
import { createIntelligenceHandlers } from "./handlers.js";

const handlers = createIntelligenceHandlers({ authenticate: auth, dispatchAction: dispatchIntelligenceAction });
export const GET = handlers.GET;
export const POST = handlers.POST;
