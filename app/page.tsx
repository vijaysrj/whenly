import { redirect } from "next/navigation";
import { isSignedIn } from "@/lib/auth";
import { getPinned, listEvents } from "@/lib/db";
import WhenlyApp from "@/components/WhenlyApp";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isSignedIn())) redirect("/login");
  const [events, pinned] = await Promise.all([listEvents(), getPinned()]);
  return <WhenlyApp initialEvents={events} initialPinned={pinned} />;
}
