export const PLANETS = [
  { name: "Mercury", a: 0.387, color: 0x9c8f86, radius: 0.45, radiusKm: 2439.7, tilt: 0.01, spin: 0.5 },
  { name: "Venus", a: 0.723, color: 0xcbb27c, radius: 0.95, radiusKm: 6051.8, tilt: 0.05, spin: 0.15 },
  { name: "Earth", a: 1.0, color: 0x4b86d4, radius: 1.0, radiusKm: 6371.0, tilt: 0.41, spin: 0.6 },
  { name: "Mars", a: 1.524, color: 0xb65a3a, radius: 0.65, radiusKm: 3389.5, tilt: 0.44, spin: 0.55 },
  { name: "Jupiter", a: 5.204, color: 0xd0aa7a, radius: 3.2, radiusKm: 69911, tilt: 0.05, spin: 0.9 },
  { name: "Saturn", a: 9.58, color: 0xd9c29a, radius: 2.7, radiusKm: 58232, tilt: 0.46, spin: 0.7 },
  { name: "Uranus", a: 19.2, color: 0x7ac6c6, radius: 1.55, radiusKm: 25362, tilt: 1.71, spin: 0.4 },
  { name: "Neptune", a: 30.05, color: 0x3b5ed8, radius: 1.45, radiusKm: 24622, tilt: 0.5, spin: 0.45 },
];

export function planetByName(name) {
  return PLANETS.find((p) => p.name.toLowerCase() === String(name).toLowerCase());
}
