const { deleteAuthUser } = require("../../server-auth-delete");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const result = await deleteAuthUser({
      uid: body.uid,
      idToken: event.headers.authorization?.replace(/^Bearer\s+/i, "")
    });
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: error.message || "Unable to delete Auth account." })
    };
  }
};
