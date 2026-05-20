import { useCallback, useEffect, useRef, useState } from "react";
import { gitIsRepo, gitStatus, type GitStatusResult } from "./api";
import { usePreferencesStore } from "@/modules/settings/preferences";

// Adaptive polling: fast for small repos, backs off for large ones
const POLL_FAST = 3000;      // small repos: 3s
const POLL_MEDIUM = 8000;    // medium repos (100-500 entries): 8s
const POLL_SLOW = 15000;     // large repos (500+ entries): 15s
const LARGE_REPO_THRESHOLD = 500;
const MEDIUM_REPO_THRESHOLD = 100;

function getPollInterval(entryCount: number): number {
  if (entryCount >= LARGE_REPO_THRESHOLD) return POLL_SLOW;
  if (entryCount >= MEDIUM_REPO_THRESHOLD) return POLL_MEDIUM;
  return POLL_FAST;
}

export function useGitStatus(rootPath: string | null) {
  const [status, setStatus] = useState<GitStatusResult | null>(null);
  const [isRepo, setIsRepo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const repoConfirmedRef = useRef(false);
  const inFlightRef = useRef(false);
  const gitEnabled = usePreferencesStore((s) => s.gitEnabled);

  const refresh = useCallback(async () => {
    if (!rootPath || !gitEnabled) {
      setStatus(null);
      setIsRepo(false);
      return;
    }

    // Prevent overlapping requests (critical for large repos)
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      setLoading(true);

      // Only check gitIsRepo once until rootPath changes
      if (!repoConfirmedRef.current) {
        const repoCheck = await gitIsRepo(rootPath);
        if (!mountedRef.current) return;
        setIsRepo(repoCheck);
        if (!repoCheck) {
          setStatus(null);
          setError(null);
          setLoading(false);
          return;
        }
        repoConfirmedRef.current = true;
      }

      const result = await gitStatus(rootPath);
      if (!mountedRef.current) return;

      setStatus(result);
      setError(null);

      // Adapt polling interval based on repo size
      const newInterval = getPollInterval(result.entries.length);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(refresh, newInterval);
      }
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // If git_status fails, repo might no longer exist — reset confirmation
      if (msg.includes("Not a git repository")) {
        repoConfirmedRef.current = false;
        setIsRepo(false);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
      inFlightRef.current = false;
    }
  }, [rootPath, gitEnabled]);

  // Reset repo confirmation when rootPath changes
  useEffect(() => {
    repoConfirmedRef.current = false;
  }, [rootPath]);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    intervalRef.current = setInterval(refresh, POLL_FAST);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  return { status, isRepo, loading, error, refresh };
}
