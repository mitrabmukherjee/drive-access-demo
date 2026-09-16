import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { driveClientForUser, googleErrorMessage } from "@/lib/drive";
import { publish } from "@/lib/live";

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const file = await db.driveFile.findUnique({
    where: { id },
    include: { assignments: true },
  });
  if (!file || file.ownerId !== session.user.id) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    try {
      const drive = await driveClientForUser(session.user.id);
      await drive.files.update({
        fileId: file.driveFileId,
        supportsAllDrives: true,
        requestBody: { trashed: true },
      });
    } catch (err) {
      const msg = googleErrorMessage(err).toLowerCase();
      const unreachable =
        msg.includes("enotfound") ||
        msg.includes("getaddrinfo") ||
        msg.includes("econnrefused") ||
        msg.includes("etimedout") ||
        msg.includes("network");
      if (!msg.includes("not found") && !msg.includes("404") && !unreachable) {
        throw err;
      }
    }

    const notify = [
      session.user.email,
      ...file.assignments.map((a) => a.assigneeEmail),
    ];
    await db.driveFile.delete({ where: { id: file.id } });
    await publish(notify, {
      type: "assignment",
      action: "deleted",
      fileId: file.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err.code === "NO_DRIVE_TOKEN" ? 403 : 502;
    return NextResponse.json({ error: googleErrorMessage(err) }, { status });
  }
}
