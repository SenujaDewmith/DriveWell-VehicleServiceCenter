const crypto = require("crypto");

// Shared by the self-service forgot-password flow and the manager-invite
// flow — both store only this hash in reset_token_hash so a DB leak alone
// can't be replayed into a valid link.
const hashResetToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

module.exports = { hashResetToken };
