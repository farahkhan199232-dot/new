import Header from "@/components/Header";
import GroupView from "@/components/GroupView";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <Header />
      <main className="wrap">
        <GroupView id={id} />
      </main>
    </>
  );
}
