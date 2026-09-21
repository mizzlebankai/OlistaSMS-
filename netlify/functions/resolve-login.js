const { resolveLoginIdentifier } = require("../../server-login-lookup");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: { Allow: "POST" }, body: JSON.stringify({ error: "Method not allowed." }) };
  }
  if (Buffer.byteLength(event.body || "", "utf8") > 4096) {
    return { statusCode: 413, body: JSON.stringify({ error: "Request is too large." }) };
  }
  try {
    const result = await resolveLoginIdentifier(JSON.parse(event.body || "{}").identifier);
    return { statusCode: 200, headers: { "Cache-Control": "no-store" }, body: JSON.stringify(result || {}) };
  } catch (_) {
    return { statusCode: 500, body: JSON.stringify({ error: "Login lookup is temporarily unavailable." }) };
  }
};