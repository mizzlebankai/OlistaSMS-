const { initializeApp, getApps, getApp, cert, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

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
  if (serviceAccountJson) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch (error) {
      const configError = new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
      configError.statusCode = 500;
      throw configError;
    }
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      const configError = new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key.");
      configError.statusCode = 500;
      throw configError;
    }
    return initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  }

  if (process.env.GOOGLE_CLOUD_PROJECT) {
    return initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT });
  }

  const configError = new Error("Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON to the Netlify function environment and redeploy.");
  configError.statusCode = 500;
  throw configError;
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

async function verifyAdmin(idToken) {
  if (!idToken) {
    const error = new Error("An administrator session is required.");
    error.statusCode = 401;
    throw error;
  }
  const app = getAdminApp();
  const auth = getAuth(app);
  const requester = await auth.verifyIdToken(idToken);
  if (!allowedAdminEmails().includes(String(requester.email || "").toLowerCase())) {
    const error = new Error("Only an authorized administrator can purge records.");
    error.statusCode = 403;
    throw error;
  }
  enforceRateLimit(requester.uid);
  return { app, auth };
}

async function deleteQueryDocs(query) {
  const snapshot = await query.get();
  await Promise.all(snapshot.docs.map((item) => item.ref.delete()));
}

async function purgeStudentData({ student, idToken }) {
  if (!student?.id) {
    const error = new Error("A student record is required.");
    error.statusCode = 400;
    throw error;
  }

  const { app, auth } = await verifyAdmin(idToken);
  const db = getFirestore(app);
  const studentRef = db.collection("olistar_students").doc(student.id);

  await Promise.all([
    deleteQueryDocs(db.collection("olistar_grades").where("studentId", "==", student.id)),
    deleteQueryDocs(db.collection("olistar_fees").where("studentId", "==", student.id)),
    deleteQueryDocs(db.collection("applications").where("studentId", "==", student.id)),
    deleteQueryDocs(db.collection("admissions_applications").where("studentId", "==", student.id)),
    student.applicationId
      ? deleteQueryDocs(db.collection("admissions_applications").where("applicationId", "==", student.applicationId))
      : Promise.resolve()
  ]);

  const attendanceSnapshot = await db.collection("olistar_attendance").get();
  await Promise.all(attendanceSnapshot.docs.map(async (item) => {
    const data = item.data();
    const records = Array.isArray(data.records) ? data.records : [];
    const remaining = records.filter((record) => record?.studentId !== student.id);
    if (remaining.length === records.length) return;
    if (remaining.length) await item.ref.update({ records: remaining });
    else await item.ref.delete();
  }));

  const loginKeys = [student.institutionalEmail?.toLowerCase(), student.studentCode, student.studentCode?.toUpperCase()].filter(Boolean);
  await Promise.all(loginKeys.map((key) => db.collection("olistar_login_index").doc(key).delete()));
  await db.collection("olistar_users").doc(student.authUid || "").delete().catch(() => {});
  await studentRef.delete();

  if (student.authUid) {
    try {
      await auth.deleteUser(student.authUid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
  }
  return { deleted: true };
}

async function purgeTeacherData({ teacher, idToken }) {
  if (!teacher?.id) {
    const error = new Error("A staff record is required.");
    error.statusCode = 400;
    throw error;
  }

  const { app, auth } = await verifyAdmin(idToken);
  const db = getFirestore(app);
  const [timetableSnapshot, classesSnapshot] = await Promise.all([
    db.collection("olistar_timetable").where("teacherId", "==", teacher.id).get(),
    db.collection("olistar_classes").where("teacherId", "==", teacher.id).get()
  ]);

  await Promise.all(timetableSnapshot.docs.map((item) => item.ref.delete()));
  await Promise.all(classesSnapshot.docs.map((item) => item.ref.update({ teacherId: "" })));

  const loginKeys = [teacher.institutionalEmail?.toLowerCase()].filter(Boolean);
  await Promise.all(loginKeys.map((key) => db.collection("olistar_login_index").doc(key).delete()));
  if (teacher.authUid) {
    await db.collection("olistar_users").doc(teacher.authUid).delete();
  }
  await db.collection("olistar_teachers").doc(teacher.id).delete();

  if (teacher.authUid) {
    try {
      await auth.deleteUser(teacher.authUid);
    } catch (error) {
      if (error.code !== "auth/user-not-found") throw error;
    }
  }
  return { deleted: true };
}

module.exports = { deleteAuthUser, getAdminApp, purgeStudentData, purgeTeacherData };
