import GiftPotApp from "@/components/GiftPotApp.tsx";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GiftPotApp id={id} />;
}
