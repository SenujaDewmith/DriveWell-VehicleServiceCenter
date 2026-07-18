const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { logActivity } = require("../lib/activityLogger");

const MANAGER_ROLE = 1;

const listChargeCatalog = async (req, res) => {
  try {
    const isManager = req.user?.role_id === MANAGER_ROLE;
    const items = await prisma.chargeCatalogItem.findMany({
      where: isManager ? {} : { is_active: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    res.status(200).json({ items });
  } catch (error) {
    logger.error(`listChargeCatalog failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createChargeCatalogItem = async (req, res) => {
  const { name, description, default_price, category } = req.body;
  try {
    const item = await prisma.chargeCatalogItem.create({
      data: { name, description: description || null, default_price, category: category || null },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "CHARGE_CATALOG_ITEM_CREATED", entity_type: "charge_catalog_item", entity_id: item.catalog_item_id });
    res.status(201).json({ message: "Charge catalog item created", item });
  } catch (error) {
    logger.error(`createChargeCatalogItem failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateChargeCatalogItem = async (req, res) => {
  const { name, description, default_price, category } = req.body;
  try {
    const item = await prisma.chargeCatalogItem.update({
      where: { catalog_item_id: parseInt(req.params.id) },
      data: { name, description: description || null, default_price, category: category || null },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "CHARGE_CATALOG_ITEM_UPDATED", entity_type: "charge_catalog_item", entity_id: item.catalog_item_id });
    res.status(200).json({ message: "Charge catalog item updated", item });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Charge catalog item not found" });
    logger.error(`updateChargeCatalogItem failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deactivateChargeCatalogItem = async (req, res) => {
  try {
    const item = await prisma.chargeCatalogItem.update({
      where: { catalog_item_id: parseInt(req.params.id) },
      data: { is_active: false },
    });
    res.status(200).json({ message: "Charge catalog item deactivated", item });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Charge catalog item not found" });
    logger.error(`deactivateChargeCatalogItem failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const activateChargeCatalogItem = async (req, res) => {
  try {
    const item = await prisma.chargeCatalogItem.update({
      where: { catalog_item_id: parseInt(req.params.id) },
      data: { is_active: true },
    });
    res.status(200).json({ message: "Charge catalog item activated", item });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Charge catalog item not found" });
    logger.error(`activateChargeCatalogItem failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listChargeCatalog, createChargeCatalogItem, updateChargeCatalogItem,
  deactivateChargeCatalogItem, activateChargeCatalogItem,
};
