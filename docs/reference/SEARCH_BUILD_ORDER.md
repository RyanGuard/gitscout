You've digested the full search pipeline prompt. Now build it.

## Session 1 — Build in this exact order:

### Step 0: Create all Supabase tables
Run the SQL from Part 7 first — create developer_profiles, developer_scores, developer_repos, api_cache, search_history, and cron_logs tables with all indexes. Everything else writes to these tables so they need to exist first.

### Step 1: Part 1 — Seed Repos (`/lib/search/seedRepos.ts`)
All role categories with weighted repos. This is static data — just get it in.

### Step 2: Part 2 — GitHub Client (`/lib/github/client.ts`)
Full implementation with rate limiting, caching to Supabase api_cache table, retry logic, and both REST + GraphQL methods. This is the foundation everything depends on. Don't scaffold — implement every method fully.

### Step 3: Part 5 — Scoring Engine (`/lib/scoring/engine.ts`)
Implement the full 5-pillar scoring algorithm with exact weights and thresholds from the prompt. Include the confidence modifier and tier assignment. This is the core IP — get every calculation right.

### Step 4: Part 3 — Quick Search (`/app/api/search/quick/route.ts`)
The fast path using GitHub Search Users API. Should return results in 1-2 seconds.

### Step 5: Part 4 — Deep Search (`/app/api/search/deep/route.ts`)
The quality path that mines repo contributors. This is where unicorns come from. Follow the 6-step algorithm exactly.

### Step 6: Part 6 — Unified Orchestrator (`/app/api/search/route.ts`)
SSE streaming endpoint that runs quick and deep in parallel and streams results to the frontend.

Don't scaffold placeholder functions. Implement the full logic for each part. Test each piece as you build it. If you hit something ambiguous, make the best decision and keep moving.

## Session 2 — After Parts 1-6 are built, I'll give you this next:

### Part 9: Location Fuzzy Matching (`/lib/search/locationMatch.ts`)

Build the fuzzy location matcher, but use this city targeting config as the source of truth for aliases. Here are the target cities with all aliases:

**Tier 1 — US Tech Hubs (index first, deepest coverage)**

San Francisco Bay Area — aliases: "san francisco", "sf", "bay area", "san francisco bay area", "san francisco, ca", "sf bay area", "silicon valley", "palo alto", "mountain view", "menlo park", "sunnyvale", "cupertino", "san jose", "oakland", "berkeley", "redwood city", "san mateo", "santa clara", "fremont", "south san francisco", "san francisco, california"

Seattle — aliases: "seattle", "seattle, wa", "seattle, washington", "bellevue", "redmond", "kirkland", "tacoma", "bellevue, wa", "redmond, wa", "seattle metro", "puget sound"

Austin — aliases: "austin", "austin, tx", "austin, texas", "atx", "round rock", "cedar park", "san marcos", "pflugerville", "georgetown, tx"

New York — aliases: "new york", "nyc", "new york city", "new york, ny", "manhattan", "brooklyn", "queens", "bronx", "new york, new york", "ny", "jersey city", "hoboken"

**Tier 2 — US Growth Markets**

Denver/Boulder — aliases: "denver", "boulder", "denver, co", "boulder, co", "denver, colorado", "boulder, colorado", "colorado springs", "fort collins"

Los Angeles — aliases: "los angeles", "la", "los angeles, ca", "santa monica", "venice", "hollywood", "pasadena", "culver city", "playa vista"

Boston — aliases: "boston", "boston, ma", "cambridge", "cambridge, ma", "boston, massachusetts", "somerville", "waltham"

Miami — aliases: "miami", "miami, fl", "miami, florida", "south florida", "fort lauderdale", "boca raton", "coral gables"

**Tier 3 — International (GitScout's competitive edge — LinkedIn is weak here, GitHub is strong)**

Buenos Aires — aliases: "buenos aires", "buenos aires, argentina", "caba", "capital federal", "argentina", "córdoba", "cordoba", "rosario", "mendoza"

São Paulo — aliases: "são paulo", "sao paulo", "brazil", "brasil", "rio de janeiro", "belo horizonte", "curitiba", "porto alegre", "florianópolis"

Bangalore — aliases: "bangalore", "bengaluru", "bangalore, india", "bengaluru, india", "india", "hyderabad", "pune", "chennai", "mumbai", "delhi", "gurgaon", "noida"

Berlin — aliases: "berlin", "berlin, germany", "germany", "münchen", "munich", "hamburg", "frankfurt", "deutschland"

Tel Aviv — aliases: "tel aviv", "tel-aviv", "israel", "tel aviv, israel", "ramat gan", "herzliya", "haifa", "jerusalem", "tlv"

London — aliases: "london", "london, uk", "london, england", "london, united kingdom", "uk", "united kingdom", "shoreditch"

Poland — aliases: "warsaw", "krakow", "kraków", "poland", "wroclaw", "wrocław", "gdansk", "poznań", "polska"

Lagos — aliases: "lagos", "lagos, nigeria", "nigeria", "abuja", "nairobi", "kenya", "accra", "ghana"

Ukraine — aliases: "kyiv", "kiev", "ukraine", "lviv", "kharkiv", "dnipro", "odesa", "odessa"

Toronto — aliases: "toronto", "toronto, canada", "canada", "vancouver", "montreal", "ottawa", "waterloo", "calgary"

Create a `TARGET_CITIES` array with id, displayName, aliases, country, tier, and indexSize for each city. Export a `findMatchingCity(locationString)` function that does case-insensitive fuzzy matching against all aliases. Also export `getCitiesByTier(tier)`.

The location matcher should:
- Be case insensitive
- Match partial strings ("San Francisco" matches "San Francisco, CA")
- Handle the aliases above as the primary matching logic
- Fall back to string includes for cities not in the list

### Part 7: Pre-Index Cron Job (`/app/api/cron/index-developers/route.ts`)

Build the Vercel cron job that pre-indexes developers into Supabase. Use the TARGET_CITIES config to prioritize which locations to index. Process Tier 1 cities first, then Tier 2, then Tier 3.

For each city:
1. Take the seed repos for each role category
2. Fetch contributors from weight-3 repos first
3. Filter contributors whose GitHub location matches the city aliases
4. Enrich with full profile + GraphQL data
5. Score with the scoring engine
6. Upsert into developer_profiles and developer_scores

Target index sizes per city are in the config. Skip profiles already indexed in the last 7 days. Add to vercel.json as a daily cron at 3am UTC.

### Part 8: Frontend Integration

Wire the search page to:
1. Query Supabase first for pre-indexed developers (instant results)
2. Then stream live API results from the orchestrator
3. Merge and deduplicate by username
4. Sort by GitScout score
5. Show the radar animation during deep search
6. Trigger unicorn celebration when 90+ score developers appear

### Dashboard City Selector

Add a city grid to the dashboard below the search bar showing indexed markets:

```
Popular Markets

🇺🇸 Bay Area    🇺🇸 Seattle    🇺🇸 Austin    🇺🇸 NYC
   5,012 devs     3,847 devs    2,103 devs   3,654 devs

🇦🇷 Buenos Aires  🇧🇷 São Paulo  🇮🇳 Bangalore
   2,891 devs      2,234 devs     2,945 devs

🇩🇪 Berlin    🇮🇱 Tel Aviv    🇬🇧 London    🇨🇦 Toronto
   2,102 devs  1,756 devs    2,834 devs   2,201 devs
```

Each card shows the live count of pre-indexed developers from Supabase. Clicking a city card immediately loads scored results from the local index — no API call, no spinner. When the index is empty (pre-launch), show "Coming soon" with the city name instead of a count.

Start building now. Begin with Step 0 (Supabase tables) and work through Step 6 in order. Go.
