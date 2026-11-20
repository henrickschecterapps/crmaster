import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { IntegrationStatus, StudioSettings } from "@/types/crm";
import { resolveWhatsappConfig } from "@/lib/whatsappQueue";

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
  return {
    databaseMode: isSupabaseConfigured() ? "supabase" : "local",
    googlePlacesLive: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    resendLive: Boolean(process.env.RESEND_API_KEY),
    whatsappApiLive: Boolean(waConfig),
    whatsappProvider: waConfig?.provider ?? settings?.whatsappProvider ?? "evolution",
    whatsappNumber:
      process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5531998427100",
    adminEmail:
      settings?.adminEmail ||
      process.env.ADMIN_EMAIL ||
      "henrickschecter@gmail.com",
    pixKey:
      settings?.pixKey ||
      process.env.NEXT_PUBLIC_PIX_KEY ||
      "henrickschecter@gmail.com",
  };
}
