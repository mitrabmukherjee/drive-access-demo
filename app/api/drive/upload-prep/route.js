import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  driveClientForUser,
  ensureDemoFolder,
  getAccessTokenForUser,
  googleErrorMessage,
} from "@/lib/drive";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const drive = await driveClientForUser(session.user.id);
    const [accessToken, folderId] = await Promise.all([
      getAccessTokenForUser(session.user.id),
      ensureDemoFolder(drive),
    ]);
    return NextResponse.json({ accessToken, folderId });
  } catch (err) {
    const status = err.code === "NO_DRIVE_TOKEN" ? 403 : 502;
    return NextResponse.json({ error: googleErrorMessage(err) }, { status });
  }
}
