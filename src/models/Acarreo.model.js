import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Acarreo = sequelize.define(
  "Acarreo",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    id_vehiculo: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "vehiculos",
        key: "id",
      },
    },

    id_cobro: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "cobros",
        key: "id",
      },
    },
    id_turno_grua: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "turno_grua",
        key: "id",
      },
    },
    id_turno_barrera: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "turno_barrera",
        key: "id",
      },
    },
    fecha_acarreo: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    fecha_ingreso: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    fecha_egreso: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    numero_acta: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    estado: {
      type: DataTypes.ENUM(
        "ACARREADO",
        "INGRESADO",
        "EGRESADO",
        "COBRADO",
        "SIN_CARGO",
      ),
    },
    direccion: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    motivo: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    fue_denuncia: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    tuvo_siniestro: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    incidencias: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    damages: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "acarreos",
    timestamps: false,
  },
);

export default Acarreo;
