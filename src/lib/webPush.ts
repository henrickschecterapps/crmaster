import * as webpush from "web-push";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import {
  FIRESTORE_COLLECTIONS,
  getFirestoreDb,
  isFirebaseConfigured,
} from "@/lib/firebase";

export interface StoredPushSubscription {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  createdAt: string;
}

interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

let cachedVapid: VapidConfig | null = null;
const memorySubscriptions = new Map<string, StoredPushSubscription>();

function subDocId(endpoint: string): string {
  let hash = 0;
  for (let i = 0; i < endpoint.length; i++) {
    hash = (hash * 31 + endpoint.charCodeAt(i)) >>> 0;
  }
  return `sub_${hash.toString(16)}_${endpoint.length}`;
}

export async function getOrCreateVapidKeys(): Promise<VapidConfig> {
  const envPub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:ultimoquadrofilmes@gmail.com";

  if (envPub && envPriv) {
    return { publicKey: envPub, privateKey: envPriv, subject };
  }

  if (cachedVapid) return cachedVapid;

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        const ref = doc(db, FIRESTORE_COLLECTIONS.settings, "vapid_keys");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as {
            publicKey?: string;
            privateKey?: string;
          };
          if (data.publicKey && data.privateKey) {
            cachedVapid = {
              publicKey: data.publicKey,
              privateKey: data.privateKey,
              subject,
            };
            return cachedVapid;
          }
        }
        const generated = webpush.generateVAPIDKeys();
        await setDoc(ref, {
          publicKey: generated.publicKey,
          privateKey: generated.privateKey,
          createdAt: new Date().toISOString(),
        });
        cachedVapid = {
          publicKey: generated.publicKey,
          privateKey: generated.privateKey,
          subject,
        };
        return cachedVapid;
      }
    } catch {
      // Fallback to generated in-memory keys
    }
  }

  const generated = webpush.generateVAPIDKeys();
  cachedVapid = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject,
  };
  return cachedVapid;
}

export async function savePushSubscription(input: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}): Promise<StoredPushSubscription> {
  const id = subDocId(input.endpoint);
  const record: StoredPushSubscription = {
    id,
    endpoint: input.endpoint,
    keys: input.keys,
    userAgent: input.userAgent?.slice(0, 140),
    createdAt: new Date().toISOString(),
  };

  memorySubscriptions.set(id, record);

  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await setDoc(
          doc(db, FIRESTORE_COLLECTIONS.pushSubscriptions, id),
          record
        );
      }
    } catch {
      // Keep memory fallback
    }
  }
  return record;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const id = subDocId(endpoint);
  memorySubscriptions.delete(id);
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.pushSubscriptions, id));
      }
    } catch {
      // Ignore
    }
  }
}

export async function listPushSubscriptions(): Promise<
  StoredPushSubscription[]
> {
  if (isFirebaseConfigured()) {
    try {
      const db = getFirestoreDb();
      if (db) {
        const snap = await getDocs(
          collection(db, FIRESTORE_COLLECTIONS.pushSubscriptions)
        );
        return snap.docs.map((d) => d.data() as StoredPushSubscription);
      }
    } catch {
      // Fall back to memory
    }
  }
  return Array.from(memorySubscriptions.values());
}

export async function sendAdminPushNotification(payload: {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<{ sent: number; failed: number }> {
  const subs = await listPushSubscriptions();
  if (subs.length === 0) return { sent: 0, failed: 0 };

  const vapid = await getOrCreateVapidKeys();
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  let sent = 0;
  let failed = 0;
  const serialized = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || "/",
    tag: payload.tag || "uq-radar",
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          serialized
        );
        sent += 1;
      } catch (err: unknown) {
        failed += 1;
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode)
            : 0;
        // Remove expired or revoked subscriptions (HTTP 404 / 410)
        if (statusCode === 404 || statusCode === 410) {
          await removePushSubscription(sub.endpoint);
        }
      }
    })
  );

  return { sent, failed };
}
