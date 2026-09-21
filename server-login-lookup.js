const { getAdminApp } = require("./server-auth-delete");

async function resolveLoginIdentifier(identifier) {
  const value = String(identifier || "").trim().toLowerCase();
  if (!value) return null;
  const studentCode = value.toUpperCase();

  const db = getAdminApp().firestore();
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
  return null;
}

module.exports = { resolveLoginIdentifier };
