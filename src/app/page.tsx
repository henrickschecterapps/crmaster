import { cookies } from "next/headers";
import { getStoreData } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";
import {
  ADMIN_SESSION_COOKIE,
  isAdminAuthEnabled,
  verifyAdminSessionToken,
} from "@/lib/auth";
import { CrmApp } from "@/components/crm/CrmApp";
import { LoginGate } from "@/components/crm/LoginGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function HomePage() {
  const data = await getStoreData();

  if (isAdminAuthEnabled(data.settings)) {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
    const valid = await verifyAdminSessionToken(token, data.settings);
    if (!valid) {
      return (
        <LoginGate
          studioName={data.settings.studioName}
          requireEmail={Boolean(data.settings.adminEmail)}
        />
      );
    }
  }

  const status = getIntegrationStatus(data.settings);

  return <CrmApp initialData={data} initialStatus={status} />;
}
