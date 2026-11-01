import { NearPotApp } from "@/components/near/NearPotApp";

export default async function NearPotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <NearPotApp id={Number(id)} />;
}
