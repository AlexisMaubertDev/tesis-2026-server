import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Turno_Barrera = sequelize.define(
  "turno_barrera",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    id_barrera: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "barreras",
        key: "id",
      },
    },

    turno: {
      type: DataTypes.ENUM("Mañana", "Tarde", "Noche"),
      allowNull: false,
    },
    fecha_inicio: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fecha_fin: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "turno_barrera",
    timestamps: false,
  },
);

export default Turno_Barrera;
