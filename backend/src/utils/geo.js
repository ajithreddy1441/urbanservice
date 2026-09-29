export function haversineKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some((n) => n === null || n === undefined || Number.isNaN(Number(n)))) {
    return null;
  }
  const toRad = (d) => (Number(d) * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function mapsDirectionUrl(latitude, longitude) {
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function composeAddress(parts) {
  return [parts.houseNo || parts.house_no, parts.street, parts.area, parts.city, parts.state, parts.pincode]
    .map((p) => (p ? String(p).trim() : ''))
    .filter(Boolean)
    .join(', ');
}
