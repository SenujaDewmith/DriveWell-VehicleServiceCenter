const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const PACKAGES_DIR = path.join(__dirname, "../../uploads/packages");
fs.mkdirSync(PACKAGES_DIR, { recursive: true });

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

module.exports = { uploadPackageImage, PACKAGES_DIR };
