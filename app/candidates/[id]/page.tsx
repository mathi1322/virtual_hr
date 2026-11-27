import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getBlueprint, getCandidate } from "@/lib/db";
import CandidateView from "@/components/CandidateView";

export default async function CandidatePage(props: PageProps<"/candidates/[id]">) {
  await connection();
  const { id } = await props.params;
  const c = getCandidate(id);
  if (!c) notFound();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { filePath, ...safe } = c;
  return <CandidateView initial={{ ...safe, blueprint: c.roleKey ? getBlueprint(c.roleKey) : null }} />;
}
