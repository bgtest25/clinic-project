import type { Patient } from '../api/types';

const STORAGE_KEY = 'havenote.recentPatients.v1';
const MAX_RECENT = 10;

export interface RecentPatient {
  id: string;
  name: string;
  dateOfBirth: string;
  lastAccessedAt: number;
}

function readStore(): RecentPatient[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentPatient[];
  } catch {
    return [];
  }
}

function writeStore(patients: RecentPatient[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
  } catch {
    // Best-effort
  }
}

export function getRecentPatients(): RecentPatient[] {
  return readStore().sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);
}

export function addRecentPatient(patient: Patient): RecentPatient[] {
  const store = readStore();
  const existing = store.findIndex((p) => p.id === patient.id);

  const entry: RecentPatient = {
    id: patient.id,
    name: patient.name,
    dateOfBirth: patient.dateOfBirth,
    lastAccessedAt: Date.now(),
  };

  if (existing >= 0) {
    store[existing] = entry;
  } else {
    store.unshift(entry);
  }

  // Keep only the most recent MAX_RECENT
  const trimmed = store
    .sort((a, b) => b.lastAccessedAt - a.lastAccessedAt)
    .slice(0, MAX_RECENT);

  writeStore(trimmed);
  return trimmed;
}

export function clearRecentPatients() {
  localStorage.removeItem(STORAGE_KEY);
}
