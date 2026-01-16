import { PLATFORM_CONFIGS } from "./platformConfigs.js";
import { searchViaDDG } from "./searchEngine.js";

/**
 * Search for profiles on a specific platform
 */
export async function searchPlatform(platform, targetType, targetValue, flags) {
  const config = PLATFORM_CONFIGS[platform];

  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Check if platform supports the target type
  if (!config.searchEndpoints.includes(targetType)) {
    console.log(`${platform} doesn't support ${targetType} search, skipping`);
    return [];
  }

  switch (platform) {
    case "twitter":
      return await searchViaDDG(config, targetType, targetValue, (u) => {
        const m = u.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/i);
        return m ? m[1] : null;
      });
    case "instagram":
      return await searchViaDDG(config, targetType, targetValue, (u) => {
        const m = u.match(/instagram\.com\/([^/?#]+)/i);
        return m ? m[1] : null;
      });
    case "linkedin":
      return await searchViaDDG(config, targetType, targetValue, (u) => {
        const m = u.match(/linkedin\.com\/in\/([^/?#]+)/i);
        return m ? m[1] : null;
      });
    case "facebook":
      return await searchViaDDG(config, targetType, targetValue, (u) => {
        const m = u.match(/facebook\.com\/(?:profile\.php\?id=\d+|[^/?#]+)/i);
        return m ? m[0].split("facebook.com/")[1] : null;
      });
    case "tiktok":
      return await searchViaDDG(config, targetType, targetValue, (u) => {
        const m = u.match(/tiktok\.com\/@([^/?#]+)/i);
        return m ? m[1] : null;
      });
    case "youtube":
      return await searchViaDDG(config, targetType, targetValue, (u) => {
        const m = u.match(/youtube\.com\/(?:@([^/?#]+)|channel\/[^/?#]+)/i);
        return m ? m[1] || null : null;
      });
    case "reddit":
      return await searchViaDDG(config, targetType, targetValue, (u) => {
        const m = u.match(/reddit\.com\/(?:user|u)\/([^/?#]+)/i);
        return m ? m[1] : null;
      });
    default:
      return [];
  }
}
