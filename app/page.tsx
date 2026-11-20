import { isSignedIn } from "@/lib/auth";
import { getPinned, listEvents } from "@/lib/db";
import WhenlyApp from "@/components/WhenlyApp";
import Landing from "@/components/Landing";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isSignedIn())) return <Landing />;
  const [events, pinned] = await Promise.all([listEvents(), getPinned()]);
  return <WhenlyApp initialEvents={events} initialPinned={pinned} />;
}
