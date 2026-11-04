import { normalizePublicSources } from '../../../../utils/publicSources.js';

const BOOLEAN_FLAGS = Object.freeze([
  'includeWebScraping', 'includeNSFW', 'includeDeepImageScan', 'includeDeepScan',
  'includeCriminal', 'includeCourt', 'includeProperty', 'includeLicensePlate',
  'includeSocialMedia', 'enableRealTimeMonitoring',
]);

export function normalizeProcessingFlags(options = {}, isTrial = false) {
  if (isTrial) {
    return { ...Object.fromEntries(BOOLEAN_FLAGS.map(key => [key, false])), includePeopleDataLabs: false, publicSources: [], licensePlateRegion: null, socialPlatforms: [] };
  }
  return {
    includeWebScraping: options.include_web_scraping !== false,
    includeNSFW: options.include_nsfw !== false,
    includeDeepImageScan: !!options.include_deep_image_scan,
    includeDeepScan: !!options.include_deep_scan,
    includePeopleDataLabs: options.include_people_data_labs === true,
    publicSources: normalizePublicSources(options.public_sources),
    includeCriminal: options.include_criminal !== false,
    includeCourt: options.include_court !== false,
    includeProperty: options.include_property !== false,
    includeLicensePlate: options.include_license_plate !== false,
    licensePlateRegion: typeof options.plate_region === 'string' ? options.plate_region : null,
    includeSocialMedia: options.include_social_media !== false,
    socialPlatforms: Array.isArray(options.social_platforms)
      ? options.social_platforms.filter(platform => typeof platform === 'string')
      : ['twitter', 'instagram', 'linkedin', 'facebook'],
    enableRealTimeMonitoring: !!options.enable_real_time_monitoring,
  };
}

export function readStoredProcessingFlags(stored) {
  try {
    const flags = typeof stored === 'string' ? JSON.parse(stored) : stored;
    if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return null;
    if (BOOLEAN_FLAGS.some(key => typeof flags[key] !== 'boolean')) return null;
    if (flags.includePeopleDataLabs !== undefined && typeof flags.includePeopleDataLabs !== 'boolean') return null;
    if (flags.publicSources !== undefined && (!Array.isArray(flags.publicSources) ||
      JSON.stringify(normalizePublicSources(flags.publicSources)) !== JSON.stringify(flags.publicSources))) return null;
    if (!Array.isArray(flags.socialPlatforms) || flags.socialPlatforms.some(platform => typeof platform !== 'string')) return null;
    if (flags.licensePlateRegion !== null && typeof flags.licensePlateRegion !== 'string') return null;
    return flags;
  } catch {
    return null;
  }
}
