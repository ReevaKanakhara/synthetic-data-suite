"use client";
import { useState, useEffect, useCallback } from "react";
import { BatchSession, BatchSessionTask } from "@/types";

const STORAGE_KEY  = "sds_active_batch";
const MAX_AGE_MS   = 1000 * 60 * 60 * 4; // 4 hours — auto-expire stale sessions

/**
 * useBatchSession
 *
 * Persists the active batch session to localStorage so it survives:
 *   - Navigation to /annotate and back
 *   - Browser refresh
 *   - Tab close and reopen (within MAX_AGE_MS)
 *
 * The session is cleared when:
 *   - All tasks reach a terminal state (SUCCESS or FAILURE)
 *   - The session is older than MAX_AGE_MS
 *   - clearSession() is called explicitly
 */
export function useBatchSession() {
  const [session, setSession] = useState<BatchSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: BatchSession = JSON.parse(raw);
        const age = Date.now() - parsed.startedAt;
        if (age < MAX_AGE_MS) {
          setSession(parsed);
        } else {
          // Stale — clean up
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  const saveSession = useCallback(
    (tasks: BatchSessionTask[], prompt: string) => {
      const s: BatchSession = {
        tasks,
        prompt,
        startedAt: Date.now(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch {
        // localStorage quota exceeded — non-fatal
        console.warn("[useBatchSession] localStorage write failed");
      }
      setSession(s);
    },
    []
  );

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  return { session, hydrated, saveSession, clearSession };
}