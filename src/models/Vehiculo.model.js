import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Vehiculo = sequelize.define(
  "Vehiculo",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    patente: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM(
        "ACARREADO",
        "INGRESADO",
        "EGRESADO",
        "COBRADO",
        "SIN_CARGO",
      ),
      allowNull: false,
    },
    marca: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    modelo: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    color: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    fecha_ingreso: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    fecha_egreso: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    codigo_qr: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tuvo_siniestro: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    fue_denuncia: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    playero_ingreso_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    playero_egreso_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    supervisor_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    grua_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "gruas",
        key: "id",
      },
    },
    caja_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "cajas",
        key: "id",
      },
    },
  },
  {
    tableName: "vehiculos",
    timestamps: false,
  },
);

export default Vehiculo;
