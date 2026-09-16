import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAccessTokenForUser, googleErrorMessage } from "@/lib/drive";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accessToken = await getAccessTokenForUser(session.user.id);
    return NextResponse.json({ accessToken });
  } catch (err) {
    const status = err.code === "NO_DRIVE_TOKEN" ? 403 : 502;
    return NextResponse.json({ error: googleErrorMessage(err) }, { status });
  }
}
