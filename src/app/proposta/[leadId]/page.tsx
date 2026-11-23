import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProposalRedirectPage(props: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await props.params;
  redirect(`/portal/${leadId}`);
}
