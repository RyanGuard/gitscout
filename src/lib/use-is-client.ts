"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** True after client hydration; false on server. Replaces mount-only useEffect + setState. */
export function useIsClient() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}
