import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const me = String(session.user.email ?? "").toLowerCase();
  const users = await db.user.findMany({
    where: { email: { not: null } },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });

  return NextResponse.json({
    users: users
      .filter((u) => String(u.email).toLowerCase() !== me)
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      })),
  });
}
