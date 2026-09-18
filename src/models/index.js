import Usuario from "./Usuario.model.js";
import Vehiculo from "./Vehiculo.model.js";
import Sucursal from "./Sucursal.model.js";
import Caja from "./Caja.model.js";
import Grua from "./Grua.model.js";
import Barrera from "./Barrera.model.js";
import Turno_Grua from "./TurnoGrua.model.js";
import Turno_Barrera from "./TurnoBarrera.model.js";
import Acarreo from "./Acarreo.model.js";
import Turno_Caja from "./TurnoCaja.model.js";
import Cobro from "./Cobro.model.js";
import Auditoria from "./Auditoria.model.js";
import Turno_Barrera_Usuario from "./TurnoBarreraUsuario.model.js";

//Usuario pertenece a una sucursal
Usuario.belongsTo(Sucursal, { foreignKey: "id_sucursal" });
Sucursal.hasMany(Usuario, { foreignKey: "id_sucursal" });

//Caja pertenece a una sucursal
Caja.belongsTo(Sucursal, { foreignKey: "id_sucursal" });
Sucursal.hasMany(Caja, { foreignKey: "id_sucursal" });

//Cajas tiene muchos Turnos
Caja.hasMany(Turno_Caja, { foreignKey: "id_caja" });
Turno_Caja.belongsTo(Caja, { foreignKey: "id_caja" });

//Usuario tiene muchos Turnos
Usuario.hasMany(Turno_Caja, { foreignKey: "id_usuario" });
Turno_Caja.belongsTo(Usuario, { foreignKey: "id_usuario" });

//Cada turno tiene muchos cobros
Turno_Caja.hasMany(Cobro, { foreignKey: "id_turno_caja" });
Cobro.belongsTo(Turno_Caja, { foreignKey: "id_turno_caja" });

//Cada turno tiene un solo cajero
Turno_Caja.belongsTo(Usuario, { foreignKey: "id_usuario" });
Usuario.hasMany(Turno_Caja, { foreignKey: "id_usuario" });

Usuario.hasOne(Turno_Grua, {
  foreignKey: "id_chofer",
  as: "turno_grua_chofer_activo",
  scope: { activo: true },
});

Usuario.hasOne(Turno_Grua, {
  foreignKey: "id_enganchador",
  as: "turno_grua_enganchador_activo",
  scope: { activo: true },
});
Usuario.hasOne(Turno_Grua, {
  foreignKey: "id_supervisor",
  as: "turno_grua_supervisor_activo",
  scope: { activo: true },
});
Grua.hasOne(Turno_Grua, {
  foreignKey: "id_grua",
  as: "turno_grua_activo",
  scope: { activo: true },
});
Turno_Grua.belongsTo(Grua, { foreignKey: "id_grua" });

Usuario.hasOne(Turno_Caja, {
  foreignKey: "usuario_id",
  as: "turno_caja_activo",
  scope: { activo: true },
});

//Cada acarreo tiene un solo cobro
Acarreo.belongsTo(Cobro, { foreignKey: "id_cobro" });
Cobro.hasOne(Acarreo, { foreignKey: "id_cobro" });

//cada acarreo tiene un solo vehiculo
Acarreo.belongsTo(Vehiculo, { foreignKey: "id_vehiculo" });
Vehiculo.hasMany(Acarreo, { foreignKey: "id_vehiculo" });

//cada acarreo tiene un solo turno de grua
Acarreo.belongsTo(Turno_Grua, { foreignKey: "id_turno_grua" });
Turno_Grua.hasMany(Acarreo, { foreignKey: "id_turno_grua" });

//cada acarreo tiene un solo turno de barrera
Acarreo.belongsTo(Turno_Barrera, { foreignKey: "id_turno_barrera" });
Turno_Barrera.hasMany(Acarreo, { foreignKey: "id_turno_barrera" });

//cada turno tiene una sola barrera
Turno_Barrera.belongsTo(Barrera, { foreignKey: "id_barrera" });
Barrera.hasMany(Turno_Barrera, { foreignKey: "id_barrera" });
Barrera.hasOne(Turno_Barrera, {
  foreignKey: "id_barrera",
  as: "turno_barrera_activo",
  scope: { activo: true },
});

//Cada usuario tiene muchos turnos de barrera
Usuario.hasMany(Turno_Barrera_Usuario, { foreignKey: "id_usuario" });

//tabla intermedia entre turno de barrera y usuario
Turno_Barrera_Usuario.belongsTo(Usuario, { foreignKey: "id_usuario" });

//Cada turno barrera puede tener muchos usuarios asignados
Turno_Barrera.hasMany(Turno_Barrera_Usuario, {
  foreignKey: "id_turno_barrera",
});

//cada turno tiene una sola grua
Turno_Grua.belongsTo(Grua, { foreignKey: "id_grua" });
Grua.hasMany(Turno_Grua, { foreignKey: "id_grua" });

// cada turno de grua tiene un solo chofer
Usuario.hasMany(Turno_Grua, { foreignKey: "id_chofer", as: "turnosChofer" });
Turno_Grua.belongsTo(Usuario, { foreignKey: "id_chofer", as: "chofer" });

// Cada turno tiene un solo enganchador
Usuario.hasMany(Turno_Grua, {
  foreignKey: "id_enganchador",
  as: "turnosEnganchador",
});
Turno_Grua.belongsTo(Usuario, {
  foreignKey: "id_enganchador",
  as: "enganchador",
});

// Cada turno de grua es asignado por un supervisor
Usuario.hasMany(Turno_Grua, {
  foreignKey: "id_supervisor",
  as: "turnosSupervisor",
});
Turno_Grua.belongsTo(Usuario, {
  foreignKey: "id_supervisor",
  as: "supervisor",
});

Grua.belongsTo(Sucursal, { foreignKey: "id_sucursal" });
Sucursal.hasMany(Grua, { foreignKey: "id_sucursal" });

Barrera.belongsTo(Sucursal, { foreignKey: "id_sucursal" });
Sucursal.hasMany(Barrera, { foreignKey: "id_sucursal" });

Usuario.hasMany(Auditoria, {
  foreignKey: "id_usuario",
});

Auditoria.belongsTo(Usuario, {
  foreignKey: "id_usuario",
});

export {
  Usuario,
  Vehiculo,
  Sucursal,
  Caja,
  Turno_Caja,
  Cobro,
  Acarreo,
  Turno_Grua,
  Turno_Barrera,
  Grua,
  Barrera,
  Auditoria,
};
