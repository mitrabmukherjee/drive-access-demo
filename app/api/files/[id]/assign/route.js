import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  driveClientForUser,
  googleErrorMessage,
  isWorkspaceEmail,
  shareFileWithEmail,
  unshareFileFromEmail,
} from "@/lib/drive";
import { publish } from "@/lib/live";

const ROLES = new Set(["reader", "writer"]);

async function requireOwner(fileId) {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const file = await db.driveFile.findUnique({
    where: { id: fileId },
    include: { assignments: true },
  });
  if (!file || file.ownerId !== session.user.id) {
    return { error: NextResponse.json({ error: "File not found" }, { status: 404 }) };
  }
  return { user: session.user, file };
}

export async function POST(request, { params }) {
  const { id } = await params;
  const gate = await requireOwner(id);
  if (gate.error) return gate.error;
  const { user, file } = gate;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const role = String(body?.role ?? "reader").trim().toLowerCase();

  if (!isWorkspaceEmail(email)) {
    return NextResponse.json(
      { error: "Assignee must be an @steorasystems.com address." },
      { status: 400 },
    );
  }
  if (!ROLES.has(role)) {
    return NextResponse.json(
      { error: "Role must be reader or writer." },
      { status: 400 },
    );
  }
  if (email === String(user.email ?? "").toLowerCase()) {
    return NextResponse.json(
      { error: "You already own this file." },
      { status: 400 },
    );
  }

  try {
    const drive = await driveClientForUser(user.id);
    const permissionId = await shareFileWithEmail(
      drive,
      file.driveFileId,
      email,
      role,
    );

    const assignment = await db.assignment.upsert({
      where: {
        fileId_assigneeEmail: { fileId: file.id, assigneeEmail: email },
      },
      create: {
        fileId: file.id,
        assigneeEmail: email,
        permissionId,
        role,
      },
      update: { permissionId, role },
    });

    await publish([user.email, email], {
      type: "assignment",
      action: "assigned",
      fileId: file.id,
      assigneeEmail: email,
    });

    return NextResponse.json({ assignment });
  } catch (err) {
    const status = err.code === "NO_DRIVE_TOKEN" ? 403 : 502;
    return NextResponse.json({ error: googleErrorMessage(err) }, { status });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const gate = await requireOwner(id);
  if (gate.error) return gate.error;
  const { user, file } = gate;

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  const assignment = file.assignments.find(
    (a) => a.assigneeEmail.toLowerCase() === email,
  );
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  try {
    const drive = await driveClientForUser(user.id);
    try {
      await unshareFileFromEmail(drive, file.driveFileId, assignment.permissionId);
    } catch (err) {
      const msg = googleErrorMessage(err).toLowerCase();
      if (!msg.includes("not found") && !msg.includes("404")) {
        throw err;
      }
    }
    await db.assignment.delete({ where: { id: assignment.id } });

    await publish([user.email, email], {
      type: "assignment",
      action: "unassigned",
      fileId: file.id,
      assigneeEmail: email,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err.code === "NO_DRIVE_TOKEN" ? 403 : 502;
    return NextResponse.json({ error: googleErrorMessage(err) }, { status });
  }
}
