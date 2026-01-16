import { emailIntel } from "../email.js";
import { usernameIntel } from "../username.js";
import { phoneIntel, reversePhoneWebScan } from "../phone.js";
import { domainIntel } from "../domain.js";
import { ipNetworkIntel } from "../network.js";
import { licenseRecordsByPlate } from "../license.js";

export async function handleEmailTarget(targetValue, data, crossRefs) {
  data.email = await emailIntel(targetValue);

  const derived = data.email?.derived_usernames || [];
  data.username = await usernameIntel(
    derived.length ? derived[0] : targetValue.split("@")[0],
    {
      extraCandidates: derived,
      includeNSFW: data.flags.include_nsfw,
      crossRefs: {
        emails: [targetValue],
        usernames: derived,
        domains: data.email?.domain ? [data.email.domain] : [],
      },
      deepScan: data.flags.include_deep_scan,
      timeBudgetMs: data.flags.include_deep_scan ? 28_000 : 14_000,
    },
  );

  crossRefs.emails.push(targetValue);
  crossRefs.usernames.push(...derived);
  if (data.email?.domain) crossRefs.domains.push(data.email.domain);

  if (data.email?.domain) {
    data.domain = await domainIntel(data.email.domain);
  }
}

export async function handleUsernameTarget(targetValue, data, crossRefs) {
  data.username = await usernameIntel(targetValue, {
    includeNSFW: data.flags.include_nsfw,
    crossRefs: { usernames: [targetValue] },
    deepScan: data.flags.include_deep_scan,
    timeBudgetMs: data.flags.include_deep_scan ? 28_000 : 14_000,
  });
  crossRefs.usernames.push(targetValue);
}

export async function handlePhoneTarget(targetValue, data, crossRefs) {
  data.phone = await phoneIntel(targetValue);
  crossRefs.phones.push(targetValue);

  if (data.flags.include_web_scraping) {
    try {
      const rev = await reversePhoneWebScan(targetValue, {
        deepScan: data.flags.include_deep_scan,
      });
      data.phone.web = rev;

      const emailSeedList = (rev.emails || []).map((e) => ({ email: e }));
      data.email_seeds = (data.email_seeds || []).concat(emailSeedList);
      data.discovered_urls = (data.discovered_urls || [])
        .concat(rev.discovered_urls || [])
        .slice(0, data.flags.include_deep_scan ? 300 : 150);

      crossRefs.emails.push(...(rev.emails || []));
    } catch (e) {
      // non-fatal
    }
  }
}

export async function handleDomainTarget(targetValue, data, crossRefs) {
  data.domain = await domainIntel(targetValue);
  crossRefs.domains.push(targetValue);
}

export async function handleIPTarget(targetValue, data) {
  data.ip_network = await ipNetworkIntel([targetValue], {
    deepScan: data.flags.include_deep_scan,
  });
}

export async function handleLicensePlateTarget(targetValue, data) {
  if (data.flags.include_license_plate) {
    try {
      const res = await licenseRecordsByPlate(
        targetValue,
        data.license_plate.region,
      );
      data.records.license_plates.items = res.items || [];
      data.records.license_plates.errors = res.errors || [];
    } catch (e) {
      data.records.license_plates.errors.push(e.message);
    }
  }
}
