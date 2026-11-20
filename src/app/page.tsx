import { getStoreData } from "@/lib/repository";
import { getIntegrationStatus } from "@/lib/supabase";
import { CrmApp } from "@/components/crm/CrmApp";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getStoreData();
  const status = getIntegrationStatus(data.settings);

  return <CrmApp initialData={data} initialStatus={status} />;
}
