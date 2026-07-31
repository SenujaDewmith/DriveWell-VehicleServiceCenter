const prisma = require("../lib/prisma");
const logger = require("../utils/logger");
const { logActivity } = require("../lib/activityLogger");

// Case-insensitive existence check, scoped and excluding the row being edited (if any) —
// the DB @@unique constraints are exact-case and only a last-resort backstop, so this is
// the actual guard against "Toyota" vs "toyota" duplicates.
const findDuplicate = (model, where, excludeId, idField) =>
  model.findFirst({ where: { ...where, ...(excludeId ? { [idField]: { not: excludeId } } : {}) } });

// ---- Makes ----------------------------------------------------------------

const listMakesAdmin = async (req, res) => {
  try {
    const makes = await prisma.vehicleMake.findMany({
      include: { _count: { select: { models: true, vehicles: true } } },
      orderBy: { name: "asc" },
    });
    res.status(200).json({
      makes: makes.map((m) => ({
        make_id: m.make_id,
        name: m.name,
        model_count: m._count.models,
        vehicle_count: m._count.vehicles,
      })),
    });
  } catch (error) {
    logger.error(`listMakesAdmin failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createMake = async (req, res) => {
  const { name } = req.body;
  try {
    const duplicate = await findDuplicate(prisma.vehicleMake, { name: { equals: name, mode: "insensitive" } });
    if (duplicate) return res.status(409).json({ message: `A make named "${name}" already exists` });

    const make = await prisma.vehicleMake.create({ data: { name } });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_MAKE_CREATED", entity_type: "vehicle_make", entity_id: make.make_id });
    res.status(201).json({ message: "Make created", make });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ message: `A make named "${name}" already exists` });
    logger.error(`createMake failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateMake = async (req, res) => {
  const { name } = req.body;
  const make_id = parseInt(req.params.id);
  try {
    const duplicate = await findDuplicate(prisma.vehicleMake, { name: { equals: name, mode: "insensitive" } }, make_id, "make_id");
    if (duplicate) return res.status(409).json({ message: `A make named "${name}" already exists` });

    const make = await prisma.vehicleMake.update({ where: { make_id }, data: { name } });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_MAKE_UPDATED", entity_type: "vehicle_make", entity_id: make.make_id });
    res.status(200).json({ message: "Make updated", make });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Make not found" });
    if (error.code === "P2002") return res.status(409).json({ message: `A make named "${name}" already exists` });
    logger.error(`updateMake failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteMake = async (req, res) => {
  const make_id = parseInt(req.params.id);
  try {
    const [modelCount, vehicleCount] = await Promise.all([
      prisma.vehicleModel.count({ where: { make_id } }),
      prisma.vehicle.count({ where: { make_id } }),
    ]);
    if (modelCount > 0 || vehicleCount > 0) {
      return res.status(409).json({
        message: `Cannot delete — this make has ${modelCount} model(s) and ${vehicleCount} vehicle(s) attached.`,
      });
    }
    await prisma.vehicleMake.delete({ where: { make_id } });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_MAKE_DELETED", entity_type: "vehicle_make", entity_id: make_id });
    res.status(200).json({ message: "Make deleted" });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Make not found" });
    logger.error(`deleteMake failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

// ---- Models -----------------------------------------------------------------

const listModelsAdmin = async (req, res) => {
  const { make_id } = req.query;
  try {
    const models = await prisma.vehicleModel.findMany({
      where: make_id ? { make_id: parseInt(make_id) } : {},
      include: { make: { select: { name: true } }, vehicle_type: { select: { name: true } }, _count: { select: { vehicles: true } } },
      orderBy: { name: "asc" },
    });
    res.status(200).json({
      models: models.map((m) => ({
        model_id: m.model_id,
        name: m.name,
        make_id: m.make_id,
        make_name: m.make.name,
        vehicle_type_id: m.vehicle_type_id,
        vehicle_type_name: m.vehicle_type?.name ?? null,
        start_year: m.start_year,
        end_year: m.end_year,
        vehicle_count: m._count.vehicles,
      })),
    });
  } catch (error) {
    logger.error(`listModelsAdmin failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createModel = async (req, res) => {
  const { name, make_id, vehicle_type_id, start_year, end_year } = req.body;
  try {
    const duplicate = await findDuplicate(prisma.vehicleModel, { name: { equals: name, mode: "insensitive" }, make_id });
    if (duplicate) return res.status(409).json({ message: `A model named "${name}" already exists for this make` });

    const model = await prisma.vehicleModel.create({
      data: { name, make_id, vehicle_type_id: vehicle_type_id || null, start_year: start_year || null, end_year: end_year || null },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_MODEL_CREATED", entity_type: "vehicle_model", entity_id: model.model_id });
    res.status(201).json({ message: "Model created", model });
  } catch (error) {
    if (error.code === "P2003") return res.status(400).json({ message: "Invalid make_id or vehicle_type_id" });
    if (error.code === "P2002") return res.status(409).json({ message: `A model named "${name}" already exists for this make` });
    logger.error(`createModel failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateModel = async (req, res) => {
  const { name, make_id, vehicle_type_id, start_year, end_year } = req.body;
  const model_id = parseInt(req.params.id);
  try {
    const duplicate = await findDuplicate(prisma.vehicleModel, { name: { equals: name, mode: "insensitive" }, make_id }, model_id, "model_id");
    if (duplicate) return res.status(409).json({ message: `A model named "${name}" already exists for this make` });

    const model = await prisma.vehicleModel.update({
      where: { model_id },
      data: { name, make_id, vehicle_type_id: vehicle_type_id || null, start_year: start_year || null, end_year: end_year || null },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_MODEL_UPDATED", entity_type: "vehicle_model", entity_id: model.model_id });
    res.status(200).json({ message: "Model updated", model });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Model not found" });
    if (error.code === "P2003") return res.status(400).json({ message: "Invalid make_id or vehicle_type_id" });
    if (error.code === "P2002") return res.status(409).json({ message: `A model named "${name}" already exists for this make` });
    logger.error(`updateModel failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteModel = async (req, res) => {
  const model_id = parseInt(req.params.id);
  try {
    const vehicleCount = await prisma.vehicle.count({ where: { model_id } });
    if (vehicleCount > 0) {
      return res.status(409).json({ message: `Cannot delete — this model has ${vehicleCount} vehicle(s) attached.` });
    }
    await prisma.vehicleModel.delete({ where: { model_id } });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_MODEL_DELETED", entity_type: "vehicle_model", entity_id: model_id });
    res.status(200).json({ message: "Model deleted" });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Model not found" });
    logger.error(`deleteModel failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

// ---- Types --------------------------------------------------------------

const listTypesAdmin = async (req, res) => {
  try {
    const types = await prisma.vehicleType.findMany({
      include: { _count: { select: { models: true, vehicles: true } } },
      orderBy: { name: "asc" },
    });
    res.status(200).json({
      types: types.map((t) => ({
        type_id: t.type_id,
        name: t.name,
        model_count: t._count.models,
        vehicle_count: t._count.vehicles,
      })),
    });
  } catch (error) {
    logger.error(`listTypesAdmin failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const createType = async (req, res) => {
  const { name } = req.body;
  try {
    const duplicate = await findDuplicate(prisma.vehicleType, { name: { equals: name, mode: "insensitive" } });
    if (duplicate) return res.status(409).json({ message: `A type named "${name}" already exists` });

    const type = await prisma.vehicleType.create({ data: { name } });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_TYPE_CREATED", entity_type: "vehicle_type", entity_id: type.type_id });
    res.status(201).json({ message: "Type created", type });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ message: `A type named "${name}" already exists` });
    logger.error(`createType failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const updateType = async (req, res) => {
  const { name } = req.body;
  const type_id = parseInt(req.params.id);
  try {
    const duplicate = await findDuplicate(prisma.vehicleType, { name: { equals: name, mode: "insensitive" } }, type_id, "type_id");
    if (duplicate) return res.status(409).json({ message: `A type named "${name}" already exists` });

    const type = await prisma.vehicleType.update({ where: { type_id }, data: { name } });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_TYPE_UPDATED", entity_type: "vehicle_type", entity_id: type.type_id });
    res.status(200).json({ message: "Type updated", type });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Type not found" });
    if (error.code === "P2002") return res.status(409).json({ message: `A type named "${name}" already exists` });
    logger.error(`updateType failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteType = async (req, res) => {
  const type_id = parseInt(req.params.id);
  try {
    const [modelCount, vehicleCount] = await Promise.all([
      prisma.vehicleModel.count({ where: { vehicle_type_id: type_id } }),
      prisma.vehicle.count({ where: { vehicle_type_id: type_id } }),
    ]);
    if (modelCount > 0 || vehicleCount > 0) {
      return res.status(409).json({
        message: `Cannot delete — this type has ${modelCount} model(s) and ${vehicleCount} vehicle(s) attached.`,
      });
    }
    await prisma.vehicleType.delete({ where: { type_id } });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_TYPE_DELETED", entity_type: "vehicle_type", entity_id: type_id });
    res.status(200).json({ message: "Type deleted" });
  } catch (error) {
    if (error.code === "P2025") return res.status(404).json({ message: "Type not found" });
    logger.error(`deleteType failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

// ---- Pending customer submissions -----------------------------------------

const listPendingSubmissions = async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      where: { model_id: null },
      include: {
        make: { select: { make_id: true, name: true } },
        vehicle_type: { select: { name: true } },
        customer: { select: { email: true, customer: { select: { full_name: true } } } },
      },
      orderBy: { created_at: "desc" },
    });
    res.status(200).json({
      submissions: vehicles.map((v) => ({
        vehicle_id: v.vehicle_id,
        plate_no: v.plate_no,
        make_id: v.make_id,
        make_name: v.make?.name ?? null,
        custom_make: v.custom_make,
        custom_model: v.custom_model,
        vehicle_type_id: v.vehicle_type_id,
        vehicle_type: v.vehicle_type.name,
        year: v.year,
        customer_name: v.customer?.customer?.full_name ?? null,
        customer_email: v.customer?.email ?? null,
        created_at: v.created_at,
      })),
    });
  } catch (error) {
    logger.error(`listPendingSubmissions failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

const resolvePendingSubmissions = async (req, res) => {
  const { vehicle_ids, make_id, model_id } = req.body;
  try {
    const model = await prisma.vehicleModel.findUnique({ where: { model_id }, select: { make_id: true } });
    if (!model) return res.status(404).json({ message: "Model not found" });
    if (model.make_id !== make_id) return res.status(400).json({ message: "That model does not belong to the selected make" });

    // Guarded on model_id: null so a submission already resolved by someone else isn't silently re-touched.
    const result = await prisma.vehicle.updateMany({
      where: { vehicle_id: { in: vehicle_ids }, model_id: null },
      data: { make_id, model_id },
    });
    logActivity(prisma, { user_id: req.user.user_id, action: "VEHICLE_CATALOG_SUBMISSIONS_RESOLVED", entity_type: "vehicle_model", entity_id: model_id });
    res.status(200).json({ message: `${result.count} vehicle(s) resolved`, resolved_count: result.count });
  } catch (error) {
    logger.error(`resolvePendingSubmissions failed — ${error.message}`);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  listMakesAdmin, createMake, updateMake, deleteMake,
  listModelsAdmin, createModel, updateModel, deleteModel,
  listTypesAdmin, createType, updateType, deleteType,
  listPendingSubmissions, resolvePendingSubmissions,
};
