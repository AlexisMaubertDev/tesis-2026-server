import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Turno_Barrera_Usuario = sequelize.define(
  "turno_barrera_usuario",
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
    tableName: "turno_barrera_usuario",
    timestamps: false,
  },
);

export default Turno_Barrera_Usuario;
