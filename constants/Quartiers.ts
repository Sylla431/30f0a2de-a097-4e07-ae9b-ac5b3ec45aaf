export const QUARTIERS = [
  'Badalabougou',
  'Banconi',
  'Djelibougou',
  'Hippodrome',
  'Kalaban-Coura',
  'Lafiabougou',
  'Magnambougou',
  'Missabougou',
  'Niamakoro',
  'Sotuba',
] as const;

export type Quartier = typeof QUARTIERS[number];

// Bamako center coordinates
export const BAMAKO_CENTER = {
  latitude: 12.6392,
  longitude: -8.0029,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};
