import { usernameIntel } from "../username.js";

export async function refreshUsernameIntel(data, crossRefs) {
  const knownPhones = crossRefs.phones;
  const knownEmails = crossRefs.emails;
  const knownUsernames = crossRefs.usernames;
  const knownDomains = crossRefs.domains;

  if (!data.username && (knownEmails.length || knownUsernames.length)) {
    const seed = knownUsernames[0] || knownEmails[0]?.split("@")[0] || "";
    if (seed) {
      data.username = await usernameIntel(seed, {
        extraCandidates: knownUsernames,
        includeNSFW: data.flags.include_nsfw,
        crossRefs: {
          phones: knownPhones,
          emails: knownEmails,
          usernames: knownUsernames,
          domains: knownDomains,
        },
        deepScan: data.flags.include_deep_scan,
      });
    }
  } else if (data.username) {
    if (!data.username?.profiles?.some((p) => p.match_evidence)) {
      const seed = data.username?.query || knownUsernames[0] || "";
      if (seed) {
        const refreshed = await usernameIntel(seed, {
          extraCandidates: (data.username?.candidates || []).concat(
            knownUsernames || [],
          ),
          includeNSFW: data.flags.include_nsfw,
          crossRefs: {
            phones: knownPhones,
            emails: knownEmails,
            usernames: knownUsernames,
            domains: knownDomains,
          },
          deepScan: data.flags.include_deep_scan,
        });

        if (refreshed?.profiles?.length) data.username = refreshed;
      }
    }
  }

  if (data.username?.profiles?.length) {
    data.social.profiles = data.username.profiles;
  }
}
