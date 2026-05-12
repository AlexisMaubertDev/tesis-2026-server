import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Sucursal = sequelize.define(
  "Sucursal",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    direccion: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
  },
  {
    timestamps: false,
    tableName: "sucursales",
  },
);

export default Sucursal;
