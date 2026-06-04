import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Barrera = sequelize.define(
  "Barrera",
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
    ubicacion: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    tableName: "barreras",
    timestamps: false,
  },
);

export default Barrera;
