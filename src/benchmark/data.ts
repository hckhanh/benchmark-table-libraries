export type Row = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  age: number;
  country: string;
  city: string;
  department: string;
  jobTitle: string;
  salary: number;
  hireDate: string;
  active: boolean;
  score: number;
  projects: number;
  rating: number;
};

const FIRST = [
  "James",
  "Mary",
  "John",
  "Patricia",
  "Robert",
  "Linda",
  "Michael",
  "Barbara",
  "William",
  "Elizabeth",
  "David",
  "Jennifer",
  "Richard",
  "Maria",
  "Joseph",
  "Susan",
];
const LAST = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Hernandez",
  "Lopez",
  "Gonzalez",
  "Wilson",
  "Anderson",
  "Thomas",
];
const COUNTRY = [
  "USA",
  "UK",
  "Germany",
  "France",
  "Japan",
  "Canada",
  "Australia",
  "Brazil",
  "India",
  "Mexico",
  "Spain",
  "Italy",
];
const CITY = [
  "NYC",
  "London",
  "Berlin",
  "Paris",
  "Tokyo",
  "Toronto",
  "Sydney",
  "Sao Paulo",
  "Mumbai",
  "CDMX",
  "Madrid",
  "Rome",
];
const DEPT = [
  "Engineering",
  "Sales",
  "Marketing",
  "HR",
  "Finance",
  "Support",
  "Product",
  "Legal",
  "Ops",
];
const TITLE = [
  "Manager",
  "Senior",
  "Junior",
  "Lead",
  "Principal",
  "Director",
  "VP",
  "Analyst",
  "Specialist",
];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateRows(count: number, seed = 1): Row[] {
  const rand = mulberry32(seed);
  const rows = Array.from<Row>({ length: count });
  for (let i = 0; i < count; i++) {
    const firstName = FIRST[(rand() * FIRST.length) | 0];
    const lastName = LAST[(rand() * LAST.length) | 0];
    const country = COUNTRY[(rand() * COUNTRY.length) | 0];
    const city = CITY[(rand() * CITY.length) | 0];
    const department = DEPT[(rand() * DEPT.length) | 0];
    const jobTitle = TITLE[(rand() * TITLE.length) | 0];
    rows[i] = {
      id: i,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`,
      age: 20 + ((rand() * 45) | 0),
      country,
      city,
      department,
      jobTitle,
      salary: 30000 + ((rand() * 270000) | 0),
      hireDate: `20${10 + ((rand() * 15) | 0)}-${String(1 + ((rand() * 12) | 0)).padStart(2, "0")}-${String(1 + ((rand() * 28) | 0)).padStart(2, "0")}`,
      active: rand() > 0.25,
      score: Math.round(rand() * 10000) / 100,
      projects: (rand() * 50) | 0,
      rating: Math.round(rand() * 50) / 10,
    };
  }
  return rows;
}

let cached: { key: string; rows: Row[] } | null = null;
export function getRows(count: number): Row[] {
  const key = `${count}`;
  if (cached && cached.key === key) return cached.rows;
  const rows = generateRows(count);
  cached = { key, rows };
  return rows;
}
