// Shared shape for including a vehicle's display fields (make/model/type names) in a nested query
const VEHICLE_SELECT = {
  select: {
    plate_no: true,
    make: { select: { name: true } },
    model: { select: { name: true } },
    vehicle_type: { select: { name: true } },
  },
};

const flattenVehicleRef = (vehicle) => ({
  make: vehicle?.make?.name ?? null,
  model: vehicle?.model?.name ?? null,
  vehicle_type: vehicle?.vehicle_type?.name ?? null,
  plate_no: vehicle?.plate_no ?? null,
});

module.exports = { VEHICLE_SELECT, flattenVehicleRef };
