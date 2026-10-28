import { Providers } from "../../providers";
import { PotApp } from "@/components/PotApp";

export default async function PotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Providers>
      <PotApp id={id} />
    </Providers>
  );
}
