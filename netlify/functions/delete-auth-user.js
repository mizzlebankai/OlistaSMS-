const { deleteAuthUser } = require("../../server-auth-delete");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { "Allow": "POST" }, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  if (Buffer.byteLength(event.body || "", "utf8") > 16 * 1024) {
    return { statusCode: 413, body: JSON.stringify({ error: "Request is too large." }) };
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
