const { initializeApp, getApps, getApp, cert, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const defaultAdminEmails = [
  "mizzlebankai@gmail.com"
];

const requestLog = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

function enforceRateLimit(key) {
  const now = Date.now();
  const recent = (requestLog.get(key) || []).filter((time) => now - time < RATE_WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    const error = new Error("Too many deletion attempts. Please wait a minute and try again.");
    error.statusCode = 429;
    throw error;
  }
  recent.push(now);
  requestLog.set(key, recent);
}

function getAdminApp() {
  if (getApps().length) return getApp();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let credential = null;
  if (serviceAccountJson) {
    try {
      credential = cert(JSON.parse(serviceAccountJson));
    } catch (e) {
      console.warn("Invalid FIREBASE_SERVICE_ACCOUNT_JSON:", e.message);
    }
  }
  if (!credential) {
    try {
      credential = applicationDefault();
    } catch (_) {
      // Default credentials unavailable
    }
  }

  return initializeApp(credential ? { credential } : {});
}

function allowedAdminEmails() {
  return (process.env.OLISTAR_ADMIN_EMAILS || defaultAdminEmails.join(","))
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

async function deleteAuthUser({ uid, idToken }) {
  if (!uid || !idToken) {
    const error = new Error("A target user and admin session are required.");
    error.statusCode = 400;
    throw error;
  }

  const app = getAdminApp();
  const auth = getAuth(app);
  const requester = await auth.verifyIdToken(idToken);
  if (!allowedAdminEmails().includes(String(requester.email || "").toLowerCase())) {
    const error = new Error("Only an authorized administrator can delete Auth accounts.");
    error.statusCode = 403;
    throw error;
  }

  enforceRateLimit(requester.uid);

  try {
    await auth.deleteUser(uid);
    return { deleted: true };
  } catch (error) {
    if (error.code === "auth/user-not-found") return { deleted: false, alreadyMissing: true };
    throw error;
  }
}

module.exports = { deleteAuthUser, getAdminApp };
