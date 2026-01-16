import { logEvent } from "../utils/database.js";
import { collectSocialData } from "./social/collector.js";
import { createSocialProfile } from "./social/database.js";
import { collectSocialPosts } from "./social/postCollection.js";

// Re-export main functions for backward compatibility
export { collectSocialData, createSocialProfile, collectSocialPosts };
