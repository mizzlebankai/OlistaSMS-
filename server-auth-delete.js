const admin = require("firebase-admin");

const defaultAdminEmails = [
  "mizzlebankai@gmail.com",
  "admin-main@gmail.com",
  "admim-main@gmail.com"
];

function getAdminApp() {
  if (admin.apps.length) return admin.app();

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const credential = serviceAccountJson
    ? admin.credential.cert(JSON.parse(serviceAccountJson))
    : admin.credential.applicationDefault();

  return admin.initializeApp({ credential });
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
  const requester = await app.auth().verifyIdToken(idToken);
  if (!allowedAdminEmails().includes(String(requester.email || "").toLowerCase())) {
    const error = new Error("Only an authorized administrator can delete Auth accounts.");
    error.statusCode = 403;
    throw error;
  }

  try {
    await app.auth().deleteUser(uid);
    return { deleted: true };
  } catch (error) {
    if (error.code === "auth/user-not-found") return { deleted: false, alreadyMissing: true };
    throw error;
  }
}

module.exports = { deleteAuthUser };
