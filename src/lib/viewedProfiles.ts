// Track which developer profiles the user has viewed
// Uses localStorage — works without auth

const STORAGE_KEY = "scout_viewed_profiles";
const MAX_TRACKED = 500;

export function getViewedProfiles(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

export function markProfileViewed(username: string): void {
  if (typeof window === "undefined") return;
  try {
    const viewed = getViewedProfiles();
    viewed.add(username.toLowerCase());
    // Keep only the most recent MAX_TRACKED
    const arr = Array.from(viewed).slice(-MAX_TRACKED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function isProfileViewed(username: string): boolean {
  return getViewedProfiles().has(username.toLowerCase());
}

export function clearViewedProfiles(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently fail
  }
}

export function getViewedCount(): number {
  return getViewedProfiles().size;
}
