const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { logActivity } = require("../lib/activityLogger");

const listPackages = async (req, res) => {
  try {
    const isManager = req.user?.role_id === 1;
    const packages = await prisma.servicePackage.findMany({
      where: isManager ? {} : { is_active: true },
      orderBy: isManager ? { created_at: "desc" } : { name: "asc" },
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
  const { name, description, estimated_duration, price } = req.body;
  try {
    const pkg = await prisma.servicePackage.create({
      data: { name, description, estimated_duration, price },
    });
    logger.info(`Package created — package_id: ${pkg.package_id}`);
    logActivity(prisma, { user_id: req.user.user_id, action: "PACKAGE_UPDATED", entity_type: "service_package", entity_id: pkg.package_id });
    res.status(201).json({ message: "Package created", package: pkg });
  } catch (error) {
    logger.error(`createPackage failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updatePackage = async (req, res) => {
  const { name, description, estimated_duration, price } = req.body;
  try {
    const pkg = await prisma.servicePackage.update({
      where: { package_id: parseInt(req.params.id) },
      data: { name, description, estimated_duration, price },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "PACKAGE_UPDATED", entity_type: "service_package", entity_id: pkg.package_id });
    res.status(200).json({ message: "Package updated", package: pkg });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Package not found" });
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

module.exports = { listPackages, getPackage, createPackage, updatePackage, deactivatePackage, activatePackage };
