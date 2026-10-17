import {
  Acarreo,
  Grua,
  Sucursal,
  Turno_Grua,
  Vehiculo,
} from "../models/index.js";

// Estados de un acarreo en los que el vehículo todavía está en la playa.
const ESTADOS_EN_PLAYA = ["ACARREADO", "INGRESADO"];

export const obtenerVehiculos = async (req, res) => {
  try {
    const vehiculos = await Vehiculo.findAll({
      attributes: ["id", "patente", "marca", "modelo", "color"],
      include: [
        {
          model: Acarreo,
          attributes: ["id", "fecha_acarreo", "estado"],
          required: false,
          include: [
            {
              model: Turno_Grua,
              attributes: ["id"],
              include: [
                {
                  model: Grua,
                  attributes: ["id", "patente"],
                  include: [
                    { model: Sucursal, attributes: ["id", "nombre", "direccion"] },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    // El último acarreo define el estado y la sucursal del vehículo. Se resuelve
    // en memoria porque cada vehículo tiene pocos acarreos (evita subconsultas
    // correlacionadas o funciones de ventana).
    const data = vehiculos
      .map((vehiculo) => {
        const json = vehiculo.toJSON();

        const acarreos = [...(json.Acarreos ?? [])].sort(
          (a, b) => new Date(b.fecha_acarreo) - new Date(a.fecha_acarreo),
        );

        const ultimo = acarreos[0] ?? null;
        const estado = ultimo?.estado ?? null;
        const sucursal = ultimo?.Turno_Grua?.Grua?.Sucursal ?? null;

        return {
          id: json.id,
          patente: json.patente,
          marca: json.marca,
          modelo: json.modelo,
          color: json.color,
          cantidad_acarreos: acarreos.length,
          ultimo_acarreo: ultimo?.fecha_acarreo ?? null,
          ultimo_acarreo_estado: estado,
          en_playa: ESTADOS_EN_PLAYA.includes(estado),
          Sucursal: sucursal
            ? {
                id: sucursal.id,
                nombre: sucursal.nombre,
                direccion: sucursal.direccion,
              }
            : null,
        };
      })
      // Orden pedido: primero los que están en playa y después por la fecha del
      // último acarreo (más reciente primero). Los vehículos sin acarreos van al
      // final.
      .sort((a, b) => {
        if (a.en_playa !== b.en_playa) return a.en_playa ? -1 : 1;

        const fechaA = new Date(a.ultimo_acarreo).getTime() || 0;
        const fechaB = new Date(b.ultimo_acarreo).getTime() || 0;

        return fechaB - fechaA;
      });

    return res.status(200).json({
      success: true,
      data,
      message: "Vehiculos obtenidos exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const obtenerVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const vehiculo = await Vehiculo.findByPk(id);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado" });
    }

    return res.status(200).json({
      success: true,
      data: vehiculo,
      message: "Vehiculo obtenido exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const ingresarVehiculoAPlaya = async (req, res) => {
  try {
    const { patente, marca, modelo, color, fue_denuncia, playero_ingreso_id } =
      req.body;
    const vehiculo = await Vehiculo.create({
      patente,
      marca,
      modelo,
      color,
      playero_ingreso_id,
      estado: "INGRESADO",
      fue_denuncia,
    });

    return res.status(201).json({
      success: true,
      data: vehiculo,
      message: "Vehículo ingresado a la playa exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const editarVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    // De un vehículo sólo se editan marca, modelo y color: la patente lo
    // identifica (decisión del autor).
    const { marca, modelo, color } = req.body;

    const esTextoValido = (valor) =>
      typeof valor === "string" && valor.trim() !== "";

    if (
      !esTextoValido(marca) ||
      !esTextoValido(modelo) ||
      !esTextoValido(color)
    ) {
      return res.status(400).json({
        success: false,
        message: "Los campos marca, modelo y color son obligatorios",
      });
    }

    const vehiculo = await Vehiculo.findByPk(id);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado" });
    }

    // Igual que en el alta de acarreo (`crearAcarreo`), los datos del vehículo
    // se guardan en mayúsculas.
    await vehiculo.update({
      marca: marca.toUpperCase(),
      modelo: modelo.toUpperCase(),
      color: color.toUpperCase(),
    });

    return res.status(200).json({
      success: true,
      data: vehiculo,
      message: "Vehículo actualizado exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const eliminarVehiculo = async (req, res) => {
  try {
    const { id } = req.params;

    const vehiculo = await Vehiculo.findByPk(id);

    if (!vehiculo) {
      return res
        .status(404)
        .json({ success: false, message: "Vehículo no encontrado" });
    }

    const acarreos = await Acarreo.count({ where: { id_vehiculo: id } });

    if (acarreos > 0) {
      return res.status(409).json({
        success: false,
        message:
          "No se puede eliminar el vehículo porque tiene acarreos asociados",
      });
    }

    await vehiculo.destroy();

    return res.status(200).json({
      success: true,
      message: "Vehículo eliminado exitosamente",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
