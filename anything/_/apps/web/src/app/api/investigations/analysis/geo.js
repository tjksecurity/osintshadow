export function extractGeoMarkers(osintData, aiAnalysis) {
  const markers = [];
  const ipIntel = osintData?.ip_network?.ips || [];
  const imagesExif = osintData?.images?.exif || [];
  const propertyRecords = osintData?.records?.property_deeds?.items || [];

  // 1. IP Geolocation
  for (const ip of ipIntel) {
    if (ip.geo?.lat && ip.geo?.lon) {
      markers.push({
        lat: Number(ip.geo.lat),
        lng: Number(ip.geo.lon),
        label: `IP: ${ip.ip} • ${ip.geo.city || ip.geo.region || ip.geo.country || "Unknown"}`,
        type: "ip",
      });
    }
  }

  // 2. Image EXIF Geolocation
  for (const ex of imagesExif) {
    // Expecting normalized GPS (decimal)
    if (ex.gps?.lat && ex.gps?.lon) {
      markers.push({
        lat: Number(ex.gps.lat),
        lng: Number(ex.gps.lon),
        label: `Image Exif • ${ex.country || "Unknown Location"}`,
        type: "exif",
      });
    }
  }

  // 3. Property Records (if coordinates available)
  for (const prop of propertyRecords) {
    // Check for common coordinate fields in Estated/similar responses
    const lat = prop.latitude || prop.lat || prop.parcel?.latitude;
    const lng = prop.longitude || prop.lng || prop.parcel?.longitude;

    if (lat && lng) {
      markers.push({
        lat: Number(lat),
        lng: Number(lng),
        label: `Property: ${prop.address}`,
        type: "property",
      });
    }
  }

  return markers;
}
