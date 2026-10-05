import { getMonthData } from "@/lib/actions/transactions";
import { getWealthData } from "@/lib/actions/wealth";
import { getForecastAction } from "@/lib/actions/forecast";
import Dashboard from "@/components/Dashboard";
import { parseViewMode } from "@/hooks/useDashboard";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: any) {
  const params = await searchParams;
  let initialMonth = params?.month as string | undefined;

  if (!initialMonth) {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    initialMonth = `${yyyy}-${mm}`;
  }

  const initialView = parseViewMode(params?.view);

  const [initialData, initialWealthData, initialForecast, cookieStore] = await Promise.all([
    getMonthData(initialMonth),
    initialView === "wealth" ? getWealthData(initialMonth) : Promise.resolve(null),
    initialView === "today" || initialView === "plan" ? getForecastAction() : Promise.resolve(null),
    cookies(),
  ]);

  const initialPrivate = cookieStore.get("money_control_privacy_active")?.value === "true";

  return (
    <Dashboard
      initialData={initialData}
      initialPrivate={initialPrivate}
      initialView={initialView}
      initialWealthData={initialWealthData}
      initialForecast={initialForecast}
    />
  );
}
