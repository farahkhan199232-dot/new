import ShgApp from "@/components/ShgApp";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ShgApp id={id} />;
}
