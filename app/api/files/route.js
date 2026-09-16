import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  accountHasDriveAccess,
  driveClientForUser,
  googleErrorMessage,
  parseDriveFileId,
} from "@/lib/drive";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user: session.user };
}

function serializeFile(file) {
  return {
    id: file.id,
    driveFileId: file.driveFileId,
    url: file.url,
    title: file.title,
    createdAt: file.createdAt,
    owner: file.owner
      ? { email: file.owner.email, name: file.owner.name }
      : undefined,
    assignments: (file.assignments ?? []).map((a) => ({
      id: a.id,
      assigneeEmail: a.assigneeEmail,
      role: a.role,
      createdAt: a.createdAt,
    })),
  };
}

export async function GET() {
  const gate = await requireUser();
  if (gate.error) return gate.error;
  const { user } = gate;
  const email = String(user.email ?? "").toLowerCase();

  const account = await db.account.findFirst({
    where: { userId: user.id, provider: "google" },
  });

  const include = {
    assignments: { orderBy: { createdAt: "desc" } },
    owner: { select: { email: true, name: true } },
  };

  const [owned, assignedToMe] = await Promise.all([
    db.driveFile.findMany({
      where: { ownerId: user.id },
      include,
      orderBy: { createdAt: "desc" },
    }),
    db.driveFile.findMany({
      where: { assignments: { some: { assigneeEmail: email } } },
      include,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    hasDriveToken: accountHasDriveAccess(account),
    owned: owned.map(serializeFile),
    assignedToMe: assignedToMe.map((file) => {
      const out = serializeFile(file);
      delete out.assignments;
      return out;
    }),
  });
}

export async function POST(request) {
  const gate = await requireUser();
  if (gate.error) return gate.error;
  const { user } = gate;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = String(body?.url ?? "").trim();
  const driveFileId = parseDriveFileId(url);
  if (!driveFileId) {
    return NextResponse.json(
      { error: "Paste a Google Drive or Docs URL." },
      { status: 400 },
    );
  }

  try {
    const drive = await driveClientForUser(user.id);
    const meta = await drive.files.get({
      fileId: driveFileId,
      supportsAllDrives: true,
      fields: "id,name,webViewLink,capabilities(canShare)",
    });

    if (!meta.data.capabilities?.canShare) {
      return NextResponse.json(
        {
          error:
            "You can view this file but cannot share it. Use a file you own or that you are allowed to share.",
        },
        { status: 403 },
      );
    }

    const storedUrl = meta.data.webViewLink || url;
    const title = meta.data.name || driveFileId;

    const file = await db.driveFile.upsert({
      where: {
        ownerId_driveFileId: { ownerId: user.id, driveFileId },
      },
      create: {
        ownerId: user.id,
        driveFileId,
        url: storedUrl,
        title,
      },
      update: {
        url: storedUrl,
        title,
      },
      include: {
        assignments: { orderBy: { createdAt: "desc" } },
        owner: { select: { email: true, name: true } },
      },
    });

    return NextResponse.json({ file: serializeFile(file) });
  } catch (err) {
    const status = err.code === "NO_DRIVE_TOKEN" ? 403 : 502;
    return NextResponse.json({ error: googleErrorMessage(err) }, { status });
  }
}
