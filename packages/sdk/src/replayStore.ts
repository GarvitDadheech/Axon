import type { ReplayStore } from "./types.js";

export function createInMemoryReplayStore(): ReplayStore {
  const seen = new Set<string>();
  return {
    has(key: string) {
      return seen.has(key);
    },
    add(key: string) {
      seen.add(key);
    }
  };
}

