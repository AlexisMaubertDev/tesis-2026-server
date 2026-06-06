import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Usuarios_Turno_Barrera = sequelize.define(
  "usuarios_turno_barrera",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    id_turno_barrera: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "turno_barrera",
        key: "id",
      },
    },
    id_usuario: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
  },
  {
    tableName: "usuarios_turno_barrera",
    timestamps: false,
  },
);

export default Usuarios_Turno_Barrera;
