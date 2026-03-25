// Location fuzzy matching with city targeting config
// Handles aliases, abbreviations, partial matches for messy GitHub location data

export interface TargetCity {
  id: string;
  displayName: string;
  country: string;
  flag: string;
  tier: 1 | 2 | 3;
  aliases: string[];
}

export const TARGET_CITIES: TargetCity[] = [
  // ─── Tier 1: US Tech Hubs ───
  {
    id: "sf-bay-area",
    displayName: "Bay Area",
    country: "US",
    flag: "🇺🇸",
    tier: 1,
    aliases: [
      "san francisco", "sf", "bay area", "san francisco bay area", "san francisco, ca",
      "sf bay area", "silicon valley", "palo alto", "mountain view", "menlo park",
      "sunnyvale", "cupertino", "san jose", "oakland", "berkeley", "redwood city",
      "san mateo", "santa clara", "fremont", "south san francisco", "san francisco, california",
    ],
  },
  {
    id: "seattle",
    displayName: "Seattle",
    country: "US",
    flag: "🇺🇸",
    tier: 1,
    aliases: [
      "seattle", "seattle, wa", "seattle, washington", "bellevue", "redmond",
      "kirkland", "tacoma", "bellevue, wa", "redmond, wa", "seattle metro", "puget sound",
    ],
  },
  {
    id: "austin",
    displayName: "Austin",
    country: "US",
    flag: "🇺🇸",
    tier: 1,
    aliases: [
      "austin", "austin, tx", "austin, texas", "atx", "round rock",
      "cedar park", "san marcos", "pflugerville", "georgetown, tx",
    ],
  },
  {
    id: "nyc",
    displayName: "New York",
    country: "US",
    flag: "🇺🇸",
    tier: 1,
    aliases: [
      "new york", "nyc", "new york city", "new york, ny", "manhattan",
      "brooklyn", "queens", "bronx", "new york, new york", "ny", "jersey city", "hoboken",
    ],
  },

  // ─── Tier 2: US Growth Markets ───
  {
    id: "denver",
    displayName: "Denver/Boulder",
    country: "US",
    flag: "🇺🇸",
    tier: 2,
    aliases: [
      "denver", "boulder", "denver, co", "boulder, co", "denver, colorado",
      "boulder, colorado", "colorado springs", "fort collins",
    ],
  },
  {
    id: "la",
    displayName: "Los Angeles",
    country: "US",
    flag: "🇺🇸",
    tier: 2,
    aliases: [
      "los angeles", "la", "los angeles, ca", "santa monica", "venice",
      "hollywood", "pasadena", "culver city", "playa vista",
    ],
  },
  {
    id: "boston",
    displayName: "Boston",
    country: "US",
    flag: "🇺🇸",
    tier: 2,
    aliases: [
      "boston", "boston, ma", "cambridge", "cambridge, ma",
      "boston, massachusetts", "somerville", "waltham",
    ],
  },
  {
    id: "miami",
    displayName: "Miami",
    country: "US",
    flag: "🇺🇸",
    tier: 2,
    aliases: [
      "miami", "miami, fl", "miami, florida", "south florida",
      "fort lauderdale", "boca raton", "coral gables",
    ],
  },

  // ─── Tier 3: International ───
  {
    id: "buenos-aires",
    displayName: "Buenos Aires",
    country: "Argentina",
    flag: "🇦🇷",
    tier: 3,
    aliases: [
      "buenos aires", "buenos aires, argentina", "caba", "capital federal",
      "argentina", "córdoba", "cordoba", "rosario", "mendoza",
    ],
  },
  {
    id: "sao-paulo",
    displayName: "São Paulo",
    country: "Brazil",
    flag: "🇧🇷",
    tier: 3,
    aliases: [
      "são paulo", "sao paulo", "brazil", "brasil", "rio de janeiro",
      "belo horizonte", "curitiba", "porto alegre", "florianópolis",
    ],
  },
  {
    id: "bangalore",
    displayName: "Bangalore",
    country: "India",
    flag: "🇮🇳",
    tier: 3,
    aliases: [
      "bangalore", "bengaluru", "bangalore, india", "bengaluru, india",
      "india", "hyderabad", "pune", "chennai", "mumbai", "delhi", "gurgaon", "noida",
    ],
  },
  {
    id: "berlin",
    displayName: "Berlin",
    country: "Germany",
    flag: "🇩🇪",
    tier: 3,
    aliases: [
      "berlin", "berlin, germany", "germany", "münchen", "munich",
      "hamburg", "frankfurt", "deutschland",
    ],
  },
  {
    id: "tel-aviv",
    displayName: "Tel Aviv",
    country: "Israel",
    flag: "🇮🇱",
    tier: 3,
    aliases: [
      "tel aviv", "tel-aviv", "israel", "tel aviv, israel",
      "ramat gan", "herzliya", "haifa", "jerusalem", "tlv",
    ],
  },
  {
    id: "london",
    displayName: "London",
    country: "UK",
    flag: "🇬🇧",
    tier: 3,
    aliases: [
      "london", "london, uk", "london, england", "london, united kingdom",
      "uk", "united kingdom", "shoreditch",
    ],
  },
  {
    id: "poland",
    displayName: "Poland",
    country: "Poland",
    flag: "🇵🇱",
    tier: 3,
    aliases: [
      "warsaw", "krakow", "kraków", "poland", "wroclaw", "wrocław",
      "gdansk", "poznań", "polska",
    ],
  },
  {
    id: "lagos",
    displayName: "Lagos",
    country: "Nigeria",
    flag: "🇳🇬",
    tier: 3,
    aliases: [
      "lagos", "lagos, nigeria", "nigeria", "abuja",
      "nairobi", "kenya", "accra", "ghana",
    ],
  },
  {
    id: "ukraine",
    displayName: "Ukraine",
    country: "Ukraine",
    flag: "🇺🇦",
    tier: 3,
    aliases: [
      "kyiv", "kiev", "ukraine", "lviv", "kharkiv", "dnipro", "odesa", "odessa",
    ],
  },
  {
    id: "toronto",
    displayName: "Toronto",
    country: "Canada",
    flag: "🇨🇦",
    tier: 3,
    aliases: [
      "toronto", "toronto, canada", "canada", "vancouver", "montreal",
      "ottawa", "waterloo", "calgary",
    ],
  },
];

// ─── Matching Functions ───

export function findMatchingCity(locationString: string | null | undefined): TargetCity | null {
  if (!locationString) return null;
  const lower = locationString.toLowerCase().trim();

  for (const city of TARGET_CITIES) {
    for (const alias of city.aliases) {
      if (lower === alias || lower.includes(alias) || alias.includes(lower)) {
        return city;
      }
    }
  }

  return null;
}

export function matchesLocation(
  profileLocation: string | null | undefined,
  searchLocation: string
): boolean {
  if (!searchLocation) return true; // No filter = match all
  if (!profileLocation) return false;

  const profile = profileLocation.toLowerCase().trim();
  const search = searchLocation.toLowerCase().trim();

  // Direct match
  if (profile.includes(search) || search.includes(profile)) return true;

  // Both map to the same target city
  const profileCity = findMatchingCity(profileLocation);
  const searchCity = findMatchingCity(searchLocation);

  if (profileCity && searchCity && profileCity.id === searchCity.id) return true;

  // Search is a city alias and profile contains any alias of that city
  if (searchCity) {
    for (const alias of searchCity.aliases) {
      if (profile.includes(alias)) return true;
    }
  }

  return false;
}

export function getCitiesByTier(tier: 1 | 2 | 3): TargetCity[] {
  return TARGET_CITIES.filter((c) => c.tier === tier);
}

export function getAllCities(): TargetCity[] {
  return TARGET_CITIES;
}
