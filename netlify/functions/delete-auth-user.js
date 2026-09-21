const { deleteAuthUser, purgeStudentData, purgeTeacherData, getAdminConfigStatus } = require("../../server-auth-delete");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Allow": "POST" }, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  if (Buffer.byteLength(event.body || "", "utf8") > 16 * 1024) {
    return { statusCode: 413, body: JSON.stringify({ error: "Request is too large." }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const idToken = event.headers.authorization?.replace(/^Bearer\s+/i, "");
    const result = body.student
      ? await purgeStudentData({ student: body.student, idToken })
      : body.teacher
        ? await purgeTeacherData({ teacher: body.teacher, idToken })
      : await deleteAuthUser({ uid: body.uid, idToken });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    const safeMessage = error.message?.includes("not configured") || error.message?.includes("missing") || error.message?.includes("not valid JSON")
      ? error.message
      : "Unable to purge Firebase records. Check the Netlify Function configuration and deployment logs.";
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: safeMessage, config: error.statusCode === 500 ? getAdminConfigStatus() : undefined })
    };
  }
};
