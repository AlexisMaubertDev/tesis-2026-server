// import { DataTypes } from "sequelize";
// import sequelize from "../config/db.js";

// export const ACTIONS = {
//   INICIO_SESION: "Inicio de sesión",
//   CIERRE_SESION: "Cierre de sesión",
//   VEHICULO_INGRESADO: "Vehículo ingresado",
//   VEHICULO_EGRESADO: "Vehículo egresado",
//   VEHICULO_COBRADO: "Vehículo cobrado",
//   SALIDA_SIN_CARGO: "Salida sin cargo",
//   USUARIO_CREADO: "Usuario creado",
//   USUARIO_EDITADO: "Usuario editado",
//   USUARIO_ELIMINADO: "Usuario eliminado",
//   TURNO_INICIADO: "Turno iniciado",
//   TURNO_FINALIZADO: "Turno finalizado",
//   VEHICULO_EDITADO: "Vehículo editado",
//   DESBLOQUEO_USUARIO: "Desbloqueo de usuario",
//   BLOQUEO_USUARIO: "Bloqueo de usuario",
//   GRUA_CREADA: "Grua creada",
//   GRUA_EDITADA: "Grua editada",
//   GRUA_CERRADA: "Grua cerrada",
// };

// const AuditLog = sequelize.define(
//   "AuditLog",
//   {
//     accion: {
//       type: DataTypes.STRING(50),
//       allowNull: false,
//     },

//     entidad: {
//       type: DataTypes.STRING(50),
//       allowNull: false,
//     },

//     entidad_id: {
//       type: DataTypes.INTEGER,
//       allowNull: true,
//     },

//     descripcion: {
//       type: DataTypes.STRING(255),
//       allowNull: true,
//     },

//     datos_anteriores: {
//       type: DataTypes.JSON,
//       allowNull: true,
//     },

//     datos_nuevos: {
//       type: DataTypes.JSON,
//       allowNull: true,
//     },

//     ip: {
//       type: DataTypes.STRING(45),
//       allowNull: true,
//     },

//     fecha: {
//       type: DataTypes.DATE,
//       defaultValue: DataTypes.NOW,
//     },
//   },
//   {
//     tableName: "audit_logs",
//     timestamps: false,
//   },
// );

// export default AuditLog;
