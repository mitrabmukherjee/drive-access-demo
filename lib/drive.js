import { google } from "googleapis";
import { db } from "./db";

export const WORKSPACE_DOMAIN = "steorasystems.com";
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const DEMO_FOLDER_NAME = "Drive Access Demo";

/**
 * @param {unknown} url
 * @returns {string | null}
 */
export function parseDriveFileId(url) {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(withScheme);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "drive.google.com" && host !== "docs.google.com") {
      return null;
    }

    const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) return fileMatch[1];

    const docsMatch = u.pathname.match(
      /\/(?:document|spreadsheets|presentation|forms|drawings)\/d\/([^/]+)/,
    );
    if (docsMatch) return docsMatch[1];

    const folderMatch = u.pathname.match(/\/folders\/([^/]+)/);
    if (folderMatch) return folderMatch[1];

    const openMatch = u.pathname.match(/\/d\/([^/]+)/);
    if (openMatch) return openMatch[1];

    return u.searchParams.get("id");
  } catch {
    return null;
  }
}

export function isWorkspaceEmail(email) {
  return String(email ?? "")
    .trim()
    .toLowerCase()
    .endsWith(`@${WORKSPACE_DOMAIN}`);
}

export function googleErrorMessage(err) {
  return (
    err?.response?.data?.error?.message ||
    err?.errors?.[0]?.message ||
    err?.message ||
    "Google Drive request failed"
  );
}

export function accountHasDriveAccess(account) {
  if (!account?.refresh_token) return false;
  const scope = String(account.scope ?? "");
  return scope.split(/\s+/).includes(DRIVE_SCOPE);
}

/**
 * OAuth2 client for this app user (their Google refresh token).
 * @param {string} userId
 */
async function oauth2ForUser(userId) {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!accountHasDriveAccess(account)) {
    const error = new Error(
      "Missing Google Drive access. Sign out and sign in again, and accept Drive permission.",
    );
    error.code = "NO_DRIVE_TOKEN";
    throw error;
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.AUTH_GOOGLE_ID,
    process.env.AUTH_GOOGLE_SECRET,
  );
  oauth2.setCredentials({
    refresh_token: account.refresh_token,
    access_token: account.access_token ?? undefined,
    expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
  });

  oauth2.on("tokens", (tokens) => {
    const data = {};
    if (tokens.access_token) data.access_token = tokens.access_token;
    if (tokens.refresh_token) data.refresh_token = tokens.refresh_token;
    if (typeof tokens.expiry_date === "number") {
      data.expires_at = Math.floor(tokens.expiry_date / 1000);
    }
    if (Object.keys(data).length === 0) return;
    db.account
      .update({ where: { id: account.id }, data })
      .catch((e) => console.error("[drive] failed to persist refreshed tokens", e));
  });

  return oauth2;
}

/**
 * Drive client authenticated as this app user (their Google refresh token).
 * @param {string} userId
 */
export async function driveClientForUser(userId) {
  const oauth2 = await oauth2ForUser(userId);
  return google.drive({ version: "v3", auth: oauth2 });
}

/**
 * Short-lived Google access token for browser → Drive uploads.
 * @param {string} userId
 * @returns {Promise<string>}
 */
export async function getAccessTokenForUser(userId) {
  const oauth2 = await oauth2ForUser(userId);
  const creds = oauth2.credentials;
  if (
    creds.access_token &&
    typeof creds.expiry_date === "number" &&
    Date.now() < creds.expiry_date - 60_000
  ) {
    return creds.access_token;
  }
  const { token } = await oauth2.getAccessToken();
  if (!token) {
    const error = new Error(
      "Could not refresh Google Drive access. Sign out and sign in again.",
    );
    error.code = "NO_DRIVE_TOKEN";
    throw error;
  }
  return token;
}

/**
 * Find or create the app folder in the user's My Drive.
 * @param {import("googleapis").drive_v3.Drive} drive
 * @returns {Promise<string>}
 */
export async function ensureDemoFolder(drive) {
  const listed = await drive.files.list({
    q: [
      `name = '${DEMO_FOLDER_NAME.replace(/'/g, "\\'")}'`,
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false",
      "'root' in parents",
    ].join(" and "),
    fields: "files(id,name)",
    pageSize: 1,
    spaces: "drive",
  });
  const existing = listed.data.files?.[0]?.id;
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name: DEMO_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
      parents: ["root"],
    },
    fields: "id",
  });
  if (!created.data.id) {
    throw new Error("Could not create Drive Access Demo folder.");
  }
  return created.data.id;
}

/**
 * @param {import("googleapis").drive_v3.Drive} drive
 * @param {string} fileId
 * @param {string} email
 * @param {"reader" | "writer"} role
 */
export async function shareFileWithEmail(drive, fileId, email, role) {
  try {
    const created = await drive.permissions.create({
      fileId,
      sendNotificationEmail: false,
      supportsAllDrives: true,
      fields: "id",
      requestBody: {
        type: "user",
        role,
        emailAddress: email,
      },
    });
    return created.data.id;
  } catch (err) {
    const existing = await findPermissionForEmail(drive, fileId, email);
    if (!existing?.id) throw err;
    if (existing.role !== role) {
      await drive.permissions.update({
        fileId,
        permissionId: existing.id,
        supportsAllDrives: true,
        requestBody: { role },
      });
    }
    return existing.id;
  }
}

export async function unshareFileFromEmail(drive, fileId, permissionId) {
  await drive.permissions.delete({
    fileId,
    permissionId,
    supportsAllDrives: true,
  });
}

async function findPermissionForEmail(drive, fileId, email) {
  const list = await drive.permissions.list({
    fileId,
    supportsAllDrives: true,
    fields: "permissions(id,emailAddress,role,type)",
  });
  const needle = email.toLowerCase();
  return (list.data.permissions ?? []).find(
    (p) => String(p.emailAddress ?? "").toLowerCase() === needle,
  );
}
