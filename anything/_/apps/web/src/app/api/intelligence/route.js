import { auth } from "@/auth";
import { dispatchAction } from "../../../../services/intelligence/service.mjs";
import { createIntelligenceHandlers } from "./handlers.js";

const handlers = createIntelligenceHandlers({ authenticate: auth, dispatchAction });
export const GET = handlers.GET;
export const POST = handlers.POST;
