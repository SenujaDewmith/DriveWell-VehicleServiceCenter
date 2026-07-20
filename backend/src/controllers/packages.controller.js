const fs = require("fs");
const path = require("path");
const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { logActivity } = require("../lib/activityLogger");
const { PACKAGES_DIR } = require("../middlewares/upload.middleware");

const deleteImageFile = (imageUrl) => {
  if (!imageUrl) return;
  const filename = path.basename(imageUrl);
  const filePath = path.join(PACKAGES_DIR, filename);
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") logger.error(`Failed to delete package image — ${err.message}`);
  });
};

const listPackages = async (req, res) => {
  try {
    const isManager = req.user?.role_id === 1;
    const packages = await prisma.servicePackage.findMany({
      where: isManager ? {} : { is_active: true },
      orderBy: isManager ? { created_at: "desc" } : [{ package_code: "asc" }, { name: "asc" }],
    });
    res.status(200).json({ packages });
  } catch (error) {
    logger.error(`listPackages failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const getPackage = async (req, res) => {
  try {
    const pkg = await prisma.servicePackage.findUnique({
      where: { package_id: parseInt(req.params.id) },
    });
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    res.status(200).json({ package: pkg });
  } catch (error) {
    logger.error(`getPackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createPackage = async (req, res) => {
  const { name, package_code, description, estimated_duration, price, max_capacity } = req.body;
  try {
    const pkg = await prisma.servicePackage.create({
      data: { name, package_code, description, estimated_duration, price, max_capacity },
    });
    logger.info(`Package created — package_id: ${pkg.package_id}`);
    logActivity(prisma, { user_id: req.user.user_id, action: "PACKAGE_UPDATED", entity_type: "service_package", entity_id: pkg.package_id });
    res.status(201).json({ message: "Package created", package: pkg });
  } catch (error) {
    if (error.code === "P2002") return res.status(400).json({ message: "This package code is already in use" });
    logger.error(`createPackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updatePackage = async (req, res) => {
  const { name, package_code, description, estimated_duration, price, max_capacity } = req.body;
  try {
    const pkg = await prisma.servicePackage.update({
      where: { package_id: parseInt(req.params.id) },
      data: { name, package_code, description, estimated_duration, price, max_capacity },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "PACKAGE_UPDATED", entity_type: "service_package", entity_id: pkg.package_id });
    res.status(200).json({ message: "Package updated", package: pkg });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Package not found" });
    if (error.code === "P2002") return res.status(400).json({ message: "This package code is already in use" });
    logger.error(`updatePackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deactivatePackage = async (req, res) => {
  try {
    const pkg = await prisma.servicePackage.update({
      where: { package_id: parseInt(req.params.id) },
      data: { is_active: false },
      select: { package_id: true, name: true },
    });
    res.status(200).json({ message: "Package deactivated", package: pkg });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Package not found" });
    logger.error(`deactivatePackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const activatePackage = async (req, res) => {
  try {
    const pkg = await prisma.servicePackage.update({
      where: { package_id: parseInt(req.params.id) },
      data: { is_active: true },
      select: { package_id: true, name: true },
    });
    res.status(200).json({ message: "Package activated", package: pkg });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Package not found" });
    logger.error(`activatePackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const uploadPackageImage = async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ message: "No image file uploaded" });

  try {
    const existing = await prisma.servicePackage.findUnique({
      where: { package_id: parseInt(id) },
      select: { image_url: true },
    });
    if (!existing) {
      fs.unlink(req.file.path, () => {});
      return res.status(404).json({ message: "Package not found" });
    }

    const image_url = `/uploads/packages/${req.file.filename}`;
    const pkg = await prisma.servicePackage.update({
      where: { package_id: parseInt(id) },
      data: { image_url },
    });

    if (existing.image_url) deleteImageFile(existing.image_url);

    logActivity(prisma, { user_id: req.user.user_id, action: "PACKAGE_UPDATED", entity_type: "service_package", entity_id: pkg.package_id });
    res.status(200).json({ message: "Image uploaded", package: pkg });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Package not found" });
    logger.error(`uploadPackageImage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const removePackageImage = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.servicePackage.findUnique({
      where: { package_id: parseInt(id) },
      select: { image_url: true },
    });
    if (!existing) return res.status(404).json({ message: "Package not found" });

    const pkg = await prisma.servicePackage.update({
      where: { package_id: parseInt(id) },
      data: { image_url: null },
    });

    if (existing.image_url) deleteImageFile(existing.image_url);

    logActivity(prisma, { user_id: req.user.user_id, action: "PACKAGE_UPDATED", entity_type: "service_package", entity_id: pkg.package_id });
    res.status(200).json({ message: "Image removed", package: pkg });
  } catch (error) {
    logger.error(`removePackageImage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listPackages, getPackage, createPackage, updatePackage, deactivatePackage, activatePackage,
  uploadPackageImage, removePackageImage,
};
