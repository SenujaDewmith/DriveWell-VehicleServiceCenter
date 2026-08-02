const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const PACKAGES_DIR = path.join(__dirname, "../../uploads/packages");
fs.mkdirSync(PACKAGES_DIR, { recursive: true });

const AVATARS_DIR = path.join(__dirname, "../../uploads/avatars");
fs.mkdirSync(AVATARS_DIR, { recursive: true });

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PACKAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `pkg-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.includes(file.mimetype)) {
    return cb(new Error("Only JPEG, PNG, WEBP, or GIF images are allowed"));
  }
  cb(null, true);
};

const uploadPackageImage = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Keyed on the authenticated user, not the original filename — req.user is
    // set by verifyToken, which always runs before this middleware in the route chain.
    const unique = `avatar-${req.user.user_id}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, unique);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Vehicle-transfer-request evidence photos (registration book + NIC) — never served through the
// public /uploads static mount (app.js); only readable via the manager-only, auth-gated
// document route, and deleted from disk as soon as a request is resolved.
const TRANSFER_DOCS_DIR = path.join(__dirname, "../../uploads/transfer-documents");
fs.mkdirSync(TRANSFER_DOCS_DIR, { recursive: true });

const transferDocStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TRANSFER_DOCS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${file.fieldname}-${req.user.user_id}-${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    cb(null, unique);
  },
});

const uploadTransferDocs = multer({
  storage: transferDocStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = {
  uploadPackageImage, PACKAGES_DIR,
  uploadAvatar, AVATARS_DIR,
  uploadTransferDocs, TRANSFER_DOCS_DIR,
};
