// Severity: 4 critical, 3 high, 2 medium, 1 low
export const PLACES = [
  { name: 'Guwahati, Assam', lat: 26.14, lng: 91.74 },
  { name: 'Bhubaneswar, Odisha', lat: 20.3, lng: 85.82 },
  { name: 'Kochi, Kerala', lat: 9.93, lng: 76.27 },
  { name: 'Chennai, Tamil Nadu', lat: 13.08, lng: 80.27 },
  { name: 'Patna, Bihar', lat: 25.59, lng: 85.14 },
  { name: 'Dehradun, Uttarakhand', lat: 30.32, lng: 78.03 },
  { name: 'Mumbai, Maharashtra', lat: 19.07, lng: 72.88 },
  { name: 'Kolkata, West Bengal', lat: 22.57, lng: 88.36 },
];

export const SCENARIOS = [
  { type: 'flood', severity: 4, title: 'River breach flooding low-lying wards', description: 'Water level rising 30cm/hr, families stranded on rooftops.' },
  { type: 'cyclone', severity: 3, title: 'Cyclone landfall: power and roads down', description: 'Coastal hamlets cut off, shelters needed.' },
  { type: 'fire', severity: 3, title: 'Warehouse fire spreading to residences', description: 'Dense settlement adjacent, evacuation underway.' },
  { type: 'landslide', severity: 4, title: 'Landslide blocks highway, vehicles buried', description: 'Search and rescue with heavy equipment required.' },
  { type: 'earthquake', severity: 4, title: 'M5.8 tremor: structural collapses reported', description: 'Multiple buildings damaged, people trapped.' },
  { type: 'medical', severity: 2, title: 'Waterborne illness cluster at relief camp', description: 'Dozens with diarrhoea, ORS and doctors needed.' },
  { type: 'flood', severity: 2, title: 'Waterlogging cuts off primary school', description: 'Children safe, awaiting boat evacuation.' },
];

export const SEED_TEAMS = [
  { id: 'T-01', name: 'NDRF Battalion Alpha', kind: 'rescue', lat: 26.18, lng: 91.75, status: 'available' },
  { id: 'T-02', name: 'Aqua Rescue Unit 3', kind: 'rescue', lat: 20.27, lng: 85.84, status: 'available' },
  { id: 'T-03', name: 'Kerala Fire & Rescue', kind: 'fire', lat: 9.97, lng: 76.28, status: 'available' },
  { id: 'T-04', name: 'MedAir Response', kind: 'medical', lat: 13.04, lng: 80.23, status: 'available' },
  { id: 'T-05', name: 'Relief Logistics Hub East', kind: 'logistics', lat: 22.6, lng: 88.4, status: 'available' },
  { id: 'T-06', name: 'Himalayan Rescue Team', kind: 'rescue', lat: 30.3, lng: 78.05, status: 'available' },
  { id: 'T-07', name: 'Mumbai Fire Brigade 9', kind: 'fire', lat: 19.1, lng: 72.87, status: 'available' },
  { id: 'T-08', name: 'Bihar SDRF Medical', kind: 'medical', lat: 25.6, lng: 85.12, status: 'available' },
  { id: 'T-09', name: 'Coastal Logistics Convoy', kind: 'logistics', lat: 13.1, lng: 80.3, status: 'available' },
  { id: 'T-10', name: 'Rapid Response Delta', kind: 'rescue', lat: 25.55, lng: 85.2, status: 'available' },
];

export const SEED_SHELTERS = [
  { id: 'S-01', name: 'Khanapara Indoor Stadium', lat: 26.12, lng: 91.81, capacity: 1200, occupied: 940, food: 62, water: 48, medical: 71 },
  { id: 'S-02', name: 'Kalinga Community Hall', lat: 20.29, lng: 85.8, capacity: 800, occupied: 310, food: 85, water: 90, medical: 60 },
  { id: 'S-03', name: 'Marine Drive Relief Camp', lat: 9.98, lng: 76.28, capacity: 600, occupied: 575, food: 28, water: 35, medical: 44 },
  { id: 'S-04', name: 'Marina School Shelter', lat: 13.06, lng: 80.28, capacity: 500, occupied: 220, food: 74, water: 66, medical: 80 },
  { id: 'S-05', name: 'Gandhi Maidan Camp', lat: 25.62, lng: 85.15, capacity: 1500, occupied: 1180, food: 41, water: 52, medical: 38 },
  { id: 'S-06', name: 'Rajpur Road Shelter', lat: 30.35, lng: 78.07, capacity: 400, occupied: 95, food: 92, water: 88, medical: 75 },
];

export const SEED_INCIDENTS = [
  { type: 'flood', severity: 4, title: 'Brahmaputra overflow: Jalukbari wards submerged', description: 'Water above 2m, 300 families on rooftops.', place: 'Guwahati, Assam', lat: 26.16, lng: 91.67, peopleAffected: 2400 },
  { type: 'cyclone', severity: 3, title: 'Cyclone landfall near Puri: coastal villages cut off', description: 'Power out, roads blocked by fallen trees.', place: 'Puri, Odisha', lat: 19.81, lng: 85.83, peopleAffected: 5200 },
  { type: 'landslide', severity: 4, title: 'Landslide buries vehicles on Rishikesh highway', description: 'Heavy rain triggered slope failure.', place: 'Rishikesh, Uttarakhand', lat: 30.1, lng: 78.29, peopleAffected: 60 },
  { type: 'fire', severity: 3, title: 'Warehouse fire spreading toward housing block', description: 'Evacuation of 120 residents underway.', place: 'Mumbai, Maharashtra', lat: 19.05, lng: 72.9, peopleAffected: 120 },
  { type: 'medical', severity: 2, title: 'Waterborne illness cluster at Kochi relief camp', description: 'ORS and doctors requested.', place: 'Kochi, Kerala', lat: 9.95, lng: 76.3, peopleAffected: 85 },
  { type: 'flood', severity: 3, title: 'Kosi embankment seepage: villages on alert', description: 'Preemptive evacuation recommended.', place: 'Patna, Bihar', lat: 25.65, lng: 85.2, peopleAffected: 1800 },
  { type: 'earthquake', severity: 2, title: 'M4.6 tremor: minor structural damage', description: 'Inspection of old buildings required.', place: 'Kolkata, West Bengal', lat: 22.55, lng: 88.33, peopleAffected: 300 },
];

// Past, already-resolved incidents so the analytics page has history to chart.
export const SEED_HISTORY = [
  ['flood', 3, 'Urban flooding in Sion underpasses', 'Mumbai, Maharashtra', 19.04, 72.86, 900, 52, 14, 'Mumbai Fire Brigade 9'],
  ['fire', 2, 'Market stall fire contained', 'Patna, Bihar', 25.61, 85.14, 140, 11, 3, 'Bihar SDRF Medical'],
  ['landslide', 4, 'Road collapse near Mussoorie', 'Dehradun, Uttarakhand', 30.45, 78.07, 70, 38, 9, 'Himalayan Rescue Team'],
  ['medical', 2, 'Heatstroke cases at relief camp', 'Chennai, Tamil Nadu', 13.08, 80.27, 60, 18, 4, 'MedAir Response'],
  ['cyclone', 3, 'Storm surge warnings, villages evacuated', 'Bhubaneswar, Odisha', 20.3, 85.82, 3200, 74, 21, 'Aqua Rescue Unit 3'],
  ['flood', 4, 'Dam release floods riverside colony', 'Guwahati, Assam', 26.15, 91.7, 1500, 26, 11, 'NDRF Battalion Alpha'],
  ['earthquake', 3, 'M5.1 tremor, cracked buildings', 'Kolkata, West Bengal', 22.57, 88.36, 480, 33, 7, 'Relief Logistics Hub East'],
  ['fire', 3, 'Godown fire near residential lane', 'Kochi, Kerala', 9.95, 76.29, 210, 15, 5, 'Kerala Fire & Rescue'],
];
