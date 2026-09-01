/**
 * Camera site -> coordinates.
 *
 * The activities_hackathon documents carry no latitude, so this is the lookup
 * that makes any map possible. Keys are the exact `location` values stored in
 * the collection; `label` is what an operator should actually read when the
 * stored value is a placeholder like "cam10".
 *
 * NOTE: five sites share 23.0225, 72.5714 (a city-centre coordinate rather
 * than a per-camera fix). They are spread on the map so each stays clickable -
 * see `spread` below - but the underlying position is not distinct. Replace
 * these with real per-camera fixes when they are surveyed.
 */
const SITE_COORDINATES = {
  "Rajkot Bus Port": { lat: 22.3072, lng: 70.8022 },
  "CN Vidhyalaya P2 RLVD-2027": { lat: 23.0225, lng: 72.5714, label: "CN Vidhyalaya P2" },
  Dehgam: { lat: 23.1695, lng: 72.9781 },
  "Chiman bhai Bridge": { lat: 23.0225, lng: 72.5714 },
  Janpath: { lat: 23.0225, lng: 72.5714 },
  "O.N.G.C. Office": { lat: 23.0225, lng: 72.5714 },
  Tankal: { lat: 21.272, lng: 73.098 },
  "Unknown Location (cam14)": { lat: 23.0176, lng: 72.539, label: "Ambawadi (cam14)" },
  Suvidhapark: { lat: 23.0225, lng: 72.5714 },
  "Visat T Junction": { lat: 23.072, lng: 72.58 },
  "pakwan cross road": { lat: 23.039, lng: 72.516, label: "Pakwan Cross Road" },
  cam10: { lat: 23.0072, lng: 72.6014, label: "Geeta Mandir (cam10)" },
};

/** Sites sharing one coordinate, so the map can fan them out instead of stacking. */
const collisionGroups = () => {
  const byKey = {};
  for (const [location, c] of Object.entries(SITE_COORDINATES)) {
    const key = c.lat.toFixed(4) + "," + c.lng.toFixed(4);
    (byKey[key] = byKey[key] || []).push(location);
  }
  return Object.values(byKey).filter((list) => list.length > 1);
};

/** Coordinates for a stored location value, with a display label and fan-out index. */
const coordsFor = (location) => {
  const hit = SITE_COORDINATES[location];
  if (!hit) return null;

  const group = collisionGroups().find((list) => list.includes(location)) || [location];
  return {
    lat: hit.lat,
    lng: hit.lng,
    label: hit.label || location,
    // position within a stacked group, so the map can spread them on a small arc
    spread: { index: group.indexOf(location), of: group.length },
  };
};

module.exports = { SITE_COORDINATES, coordsFor, collisionGroups };
