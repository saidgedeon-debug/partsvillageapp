import { useCallback, useSyncExternalStore } from "react";

import {
  canSeeCosts,
  canSeePayments,
  readAppRole,
  writeAppRole,
  type AppRole,
} from "@/lib/app-role";

const listeners = new Set<() => void>();
let version = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return version;
}

function bump() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function useAppRole() {
  useSyncExternalStore(subscribe, getSnapshot, () => 0);
  const role = readAppRole();

  const setRole = useCallback((next: AppRole) => {
    writeAppRole(next);
    bump();
  }, []);

  return {
    role,
    setRole,
    canSeeCosts: canSeeCosts(role),
    canSeePayments: canSeePayments(role),
  };
}
