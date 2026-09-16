import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/login");
  }
  return <Dashboard user={session.user} />;
}
