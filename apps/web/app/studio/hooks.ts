"use client";
import { useSyncExternalStore } from "react";
import type { Player } from "./player";

export const useTime = (p: Player) =>
  useSyncExternalStore(p.subscribeTime, p.getT, () => 0);
export const usePlaying = (p: Player) =>
  useSyncExternalStore(p.subscribePlaying, p.getPlaying, () => false);

const QUERY = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
export const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );

/** A boolean flag kept in localStorage. Every access is guarded. */
const flagListeners = new Set<() => void>();
export function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
export function writeFlag(key: string) {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    /* storage unavailable: lasts for this page view only */
  }
  memory.add(key);
  flagListeners.forEach((l) => l());
}
const memory = new Set<string>();
/** Server snapshot is "set" so nothing flashes before the real value is known. */
export function useFlag(key: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      flagListeners.add(cb);
      return () => {
        flagListeners.delete(cb);
      };
    },
    () => readFlag(key) || memory.has(key),
    () => true,
  );
}
