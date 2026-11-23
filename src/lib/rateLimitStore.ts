import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import {
  FIRESTORE_COLLECTIONS,
  getFirestoreDb,
  isFirebaseConfigured,
} from "@/lib/firebase";
import {
  clearLoginAttempts,
  getRateLimitStatus,
  recordFailedLoginAttempt,
} from "@/lib/auth";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

interface PersistedRateRecord {
  count: number;
  firstFailedAt: number;
  lockedUntil: number;
}

function ipDocId(ip: string): string {
  return `ip_${ip.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 64)}`;
}

export async function getPersistedRateLimitStatus(ip: string): Promise<{
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}> {
  const mem = getRateLimitStatus(ip);
  if (mem.locked) return mem;

  if (!isFirebaseConfigured()) return mem;
  try {
    const db = getFirestoreDb();
    if (!db) return mem;
    const snap = await getDoc(
      doc(db, FIRESTORE_COLLECTIONS.loginRateLimits, ipDocId(ip))
    );
    if (!snap.exists()) return mem;
    const rec = snap.data() as PersistedRateRecord;
    const now = Date.now();
    if (rec.lockedUntil > now) {
      return {
        locked: true,
        remainingAttempts: 0,
        retryAfterSeconds: Math.ceil((rec.lockedUntil - now) / 1000),
      };
    }
    if (now - rec.firstFailedAt > LOCKOUT_WINDOW_MS) {
      return {
        locked: false,
        remainingAttempts: MAX_FAILED_ATTEMPTS,
        retryAfterSeconds: 0,
      };
    }
    return {
      locked: false,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - rec.count),
      retryAfterSeconds: 0,
    };
  } catch {
    return mem;
  }
}

export async function recordPersistedFailedLoginAttempt(ip: string): Promise<{
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
}> {
  const mem = recordFailedLoginAttempt(ip);
  if (!isFirebaseConfigured()) return mem;
  try {
    const db = getFirestoreDb();
    if (!db) return mem;
    const ref = doc(db, FIRESTORE_COLLECTIONS.loginRateLimits, ipDocId(ip));
    const snap = await getDoc(ref);
    const now = Date.now();
    let next: PersistedRateRecord;
    if (!snap.exists()) {
      next = { count: 1, firstFailedAt: now, lockedUntil: 0 };
    } else {
      const curr = snap.data() as PersistedRateRecord;
      if (now - curr.firstFailedAt > LOCKOUT_WINDOW_MS) {
        next = { count: 1, firstFailedAt: now, lockedUntil: 0 };
      } else {
        const nextCount = curr.count + 1;
        next = {
          count: nextCount,
          firstFailedAt: curr.firstFailedAt,
          lockedUntil:
            nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_WINDOW_MS : 0,
        };
      }
    }
    await setDoc(ref, next);
    if (next.lockedUntil > now) {
      return {
        locked: true,
        remainingAttempts: 0,
        retryAfterSeconds: Math.ceil((next.lockedUntil - now) / 1000),
      };
    }
    return {
      locked: false,
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - next.count),
      retryAfterSeconds: 0,
    };
  } catch {
    return mem;
  }
}

export async function clearPersistedLoginAttempts(ip: string): Promise<void> {
  clearLoginAttempts(ip);
  if (!isFirebaseConfigured()) return;
  try {
    const db = getFirestoreDb();
    if (!db) return;
    await deleteDoc(
      doc(db, FIRESTORE_COLLECTIONS.loginRateLimits, ipDocId(ip))
    );
  } catch {
    // non-fatal
  }
}
