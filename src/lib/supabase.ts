import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { BRAND_DEFAULTS, IntegrationStatus, StudioSettings } from "@/types/crm";
import { resolveWhatsappConfig } from "@/lib/whatsappQueue";
import { getFirebaseProjectId, isFirebaseConfigured } from "@/lib/firebase";
import { isAdminAuthEnabled } from "@/lib/auth";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (cachedClient) return cachedClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedClient;
}

export function getIntegrationStatus(
  settings?: Partial<StudioSettings>
): IntegrationStatus {
  const waConfig = resolveWhatsappConfig(settings);
  const databaseMode: IntegrationStatus["databaseMode"] = isFirebaseConfigured()
    ? "firebase"
    : isSupabaseConfigured()
    ? "supabase"
    : "local";

  return {
    databaseMode,
    firebaseProjectId: getFirebaseProjectId(),
    googlePlacesLive: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    resendLive: Boolean(process.env.RESEND_API_KEY),
    gmailLive: Boolean(
      process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim()
    ),
    adminAuthEnabled: isAdminAuthEnabled(),
    whatsappApiLive: Boolean(waConfig),
    whatsappProvider:
      waConfig?.provider ?? settings?.whatsappProvider ?? "evolution",
    whatsappNumber:
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || BRAND_DEFAULTS.whatsappNumber,
    adminEmail:
      settings?.adminEmail || process.env.ADMIN_EMAIL || BRAND_DEFAULTS.email,
    pixKey:
      settings?.pixKey || process.env.NEXT_PUBLIC_PIX_KEY || BRAND_DEFAULTS.email,
  };
}
