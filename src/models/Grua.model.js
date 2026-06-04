import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Grua = sequelize.define(
  "Grua",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    id_sucursal: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "sucursales",
        key: "id",
      },
    },
    patente: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    modelo: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    numero: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM(
        "DISPONIBLE",
        "EN_SERVICIO",
        "FUERA_DE_SERVICIO",
        "MANTENIMIENTO",
      ),
      allowNull: false,
    },
    observaciones: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
  },
  {
    tableName: "gruas",
    timestamps: false,
  },
);

export default Grua;
