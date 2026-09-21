const { getAdminApp } = require("./server-auth-delete");
const { getFirestore } = require("firebase-admin/firestore");

async function resolveLoginIdentifier(identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  if (!value) return null;
  const studentCode = value.toUpperCase();

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const collections = ["olistar_users"];
    const fields = value.includes("@")
      ? ["institutionalEmail", "contactEmail"]
      : ["studentCode"];

    for (const collectionName of collections) {
      for (const field of fields) {
        const lookupValue = field === "studentCode" ? studentCode : value;
        const snapshot = await db.collection(collectionName).where(field, "==", lookupValue).limit(1).get();
        if (!snapshot.empty) {
          const profile = snapshot.docs[0].data();
          return {
            id: snapshot.docs[0].id,
            authEmail: String(profile.contactEmail || "").trim().toLowerCase(),
            role: profile.role || "student",
            studentId: profile.studentId || null,
            teacherId: profile.teacherId || null
          };
        }
      }
    }
  } catch (err) {
    console.warn("Server login lookup failed:", err.message);
  }
  return null;
}

module.exports = { resolveLoginIdentifier };
