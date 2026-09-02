import { getMonthData } from "@/lib/actions/transactions";
import { seedDatabase } from "@/db/seed";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: any) {
  // Ensure database tables and seed are ready
  await seedDatabase();

  const params = await searchParams;
  let initialMonth = params?.month as string | undefined;

  if (!initialMonth) {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    initialMonth = `${yyyy}-${mm}`;
  }

  const initialData = await getMonthData(initialMonth);

  return <Dashboard initialData={initialData} />;
}
