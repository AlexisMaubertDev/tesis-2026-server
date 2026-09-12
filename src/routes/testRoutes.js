import express from "express";
import {
  Acarreo,
  Auditoria,
  Barrera,
  Caja,
  Cobro,
  Grua,
  Sucursal,
  Turno_Barrera,
  Turno_Caja,
  Turno_Grua,
  Usuario,
  Vehiculo,
} from "../models/index.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      include: [
        {
          model: Sucursal,
          include: [
            {
              model: Caja,
              include: [
                {
                  model: Turno_Caja,
                  include: [
                    {
                      model: Cobro,
                      include: [
                        {
                          model: Acarreo,
                          include: [
                            { model: Vehiculo },
                            {
                              model: Turno_Grua,
                              include: [
                                { model: Grua },
                                { model: Usuario, as: "chofer" },
                                { model: Usuario, as: "enganchador" },
                                { model: Usuario, as: "supervisor" },
                              ],
                            },
                            {
                              model: Turno_Barrera,
                              include: [{ model: Barrera }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              model: Grua,
              include: [
                {
                  model: Turno_Grua,
                  include: [
                    { model: Usuario, as: "chofer" },
                    { model: Usuario, as: "enganchador" },
                    { model: Usuario, as: "supervisor" },
                  ],
                },
              ],
            },
            {
              model: Barrera,
              include: [
                {
                  model: Turno_Barrera,
                  include: [
                    {
                      model: Acarreo,
                      include: [
                        { model: Vehiculo },
                        {
                          model: Cobro,
                          include: [{ model: Turno_Caja }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: Turno_Caja,
          include: [
            { model: Caja },
            {
              model: Cobro,
              include: [
                {
                  model: Acarreo,
                  include: [
                    { model: Vehiculo },
                    {
                      model: Turno_Grua,
                      include: [
                        { model: Grua },
                        { model: Usuario, as: "chofer" },
                        { model: Usuario, as: "enganchador" },
                        { model: Usuario, as: "supervisor" },
                      ],
                    },
                    {
                      model: Turno_Barrera,
                      include: [{ model: Barrera }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: Turno_Grua,
          as: "turnosChofer",
          include: [
            { model: Grua },
            { model: Usuario, as: "enganchador" },
            { model: Usuario, as: "supervisor" },
            {
              model: Acarreo,
              include: [
                { model: Vehiculo },
                {
                  model: Cobro,
                  include: [{ model: Turno_Caja }],
                },
              ],
            },
          ],
        },
        {
          model: Turno_Grua,
          as: "turnosEnganchador",
          include: [
            { model: Grua },
            { model: Usuario, as: "chofer" },
            { model: Usuario, as: "supervisor" },
            {
              model: Acarreo,
              include: [{ model: Vehiculo }],
            },
          ],
        },
        {
          model: Turno_Grua,
          as: "turnosSupervisor",
          include: [
            { model: Grua },
            { model: Usuario, as: "chofer" },
            { model: Usuario, as: "enganchador" },
            {
              model: Acarreo,
              include: [{ model: Vehiculo }],
            },
          ],
        },
        // {
        //   model: Auditoria,
        // },
      ],
    });

    const cajas = await Caja.findAll({
      include: [
        {
          model: Sucursal,
          include: [
            {
              model: Usuario,
              // include: [{ model: Auditoria }],
            },
            {
              model: Grua,
              include: [
                {
                  model: Turno_Grua,
                  include: [
                    { model: Usuario, as: "chofer" },
                    { model: Usuario, as: "enganchador" },
                    { model: Usuario, as: "supervisor" },
                  ],
                },
              ],
            },
            {
              model: Barrera,
              include: [
                {
                  model: Turno_Barrera,
                  include: [
                    {
                      model: Acarreo,
                      include: [
                        { model: Vehiculo },
                        {
                          model: Cobro,
                          include: [{ model: Turno_Caja }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: Turno_Caja,
          include: [
            {
              model: Usuario,
              // include: [{ model: Auditoria }],
            },
            {
              model: Cobro,
              include: [
                {
                  model: Acarreo,
                  include: [
                    { model: Vehiculo },
                    {
                      model: Turno_Grua,
                      include: [
                        { model: Grua },
                        { model: Usuario, as: "chofer" },
                        { model: Usuario, as: "enganchador" },
                        { model: Usuario, as: "supervisor" },
                      ],
                    },
                    {
                      model: Turno_Barrera,
                      include: [{ model: Barrera }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const acarreos = await Acarreo.findAll({
      include: [
        {
          model: Vehiculo,
        },
        {
          model: Cobro,
          include: [
            {
              model: Turno_Caja,
              include: [
                {
                  model: Caja,
                  include: [
                    {
                      model: Sucursal,
                      include: [{ model: Grua }, { model: Barrera }],
                    },
                  ],
                },
                {
                  model: Usuario,
                  // include: [{ model: Auditoria }],
                },
              ],
            },
          ],
        },
        {
          model: Turno_Grua,
          include: [
            {
              model: Grua,
              include: [{ model: Sucursal }],
            },
            {
              model: Usuario,
              as: "chofer",
              // include: [{ model: Sucursal }, { model: Auditoria }],
            },
            {
              model: Usuario,
              as: "enganchador",
              // include: [{ model: Sucursal }, { model: Auditoria }],
            },
            {
              model: Usuario,
              as: "supervisor",
              // include: [{ model: Sucursal }, { model: Auditoria }],
            },
          ],
        },
        {
          model: Turno_Barrera,
          include: [
            {
              model: Barrera,
              include: [{ model: Sucursal }],
            },
          ],
        },
      ],
    });

    const cobros = await Cobro.findAll({
      include: [
        {
          model: Turno_Caja,
          include: [
            {
              model: Caja,
              include: [
                {
                  model: Sucursal,
                  include: [{ model: Grua }, { model: Barrera }],
                },
              ],
            },
            {
              model: Usuario,
              // include: [{ model: Sucursal }, { model: Auditoria }],
            },
          ],
        },
        {
          model: Acarreo,
          include: [
            { model: Vehiculo },
            {
              model: Turno_Grua,
              include: [
                {
                  model: Grua,
                  include: [{ model: Sucursal }],
                },
                {
                  model: Usuario,
                  as: "chofer",
                  // include: [{ model: Sucursal }, { model: Auditoria }],
                },
                {
                  model: Usuario,
                  as: "enganchador",
                  // include: [{ model: Sucursal }, { model: Auditoria }],
                },
                {
                  model: Usuario,
                  as: "supervisor",
                  // include: [{ model: Sucursal }, { model: Auditoria }],
                },
              ],
            },
            {
              model: Turno_Barrera,
              include: [
                {
                  model: Barrera,
                  include: [{ model: Sucursal }],
                },
              ],
            },
          ],
        },
      ],
    });

    const barreras = await Barrera.findAll({
      include: [
        {
          model: Sucursal,
          include: [
            {
              model: Caja,
              include: [
                {
                  model: Turno_Caja,
                  include: [
                    {
                      model: Usuario,
                      // include: [{ model: Auditoria }],
                    },
                  ],
                },
              ],
            },
            {
              model: Grua,
              include: [
                {
                  model: Turno_Grua,
                  include: [
                    { model: Usuario, as: "chofer" },
                    { model: Usuario, as: "enganchador" },
                    { model: Usuario, as: "supervisor" },
                  ],
                },
              ],
            },
            {
              model: Usuario,
              // include: [{ model: Auditoria }],
            },
          ],
        },
        {
          model: Turno_Barrera,
          include: [
            {
              model: Acarreo,
              include: [
                { model: Vehiculo },
                {
                  model: Turno_Grua,
                  include: [
                    {
                      model: Grua,
                      include: [{ model: Sucursal }],
                    },
                    {
                      model: Usuario,
                      as: "chofer",
                      // include: [{ model: Auditoria }],
                    },
                    {
                      model: Usuario,
                      as: "enganchador",
                      // include: [{ model: Auditoria }],
                    },
                    {
                      model: Usuario,
                      as: "supervisor",
                      // include: [{ model: Auditoria }],
                    },
                  ],
                },
                {
                  model: Cobro,
                  include: [
                    {
                      model: Turno_Caja,
                      include: [
                        { model: Caja },
                        {
                          model: Usuario,
                          // include: [{ model: Auditoria }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const vehiculos = await Vehiculo.findAll({
      include: [
        {
          model: Acarreo,
          include: [
            {
              model: Cobro,
              include: [
                {
                  model: Turno_Caja,
                  include: [
                    {
                      model: Caja,
                      include: [
                        {
                          model: Sucursal,
                          include: [{ model: Grua }, { model: Barrera }],
                        },
                      ],
                    },
                    {
                      model: Usuario,
                      // include: [{ model: Sucursal }, { model: Auditoria }],
                    },
                  ],
                },
              ],
            },
            {
              model: Turno_Grua,
              include: [
                {
                  model: Grua,
                  include: [{ model: Sucursal }],
                },
                {
                  model: Usuario,
                  as: "chofer",
                  // include: [{ model: Sucursal }, { model: Auditoria }],
                },
                {
                  model: Usuario,
                  as: "enganchador",
                  // include: [{ model: Sucursal }, { model: Auditoria }],
                },
                {
                  model: Usuario,
                  as: "supervisor",
                  // include: [{ model: Sucursal }, { model: Auditoria }],
                },
              ],
            },
            {
              model: Turno_Barrera,
              include: [
                {
                  model: Barrera,
                  include: [{ model: Sucursal }],
                },
              ],
            },
          ],
        },
      ],
    });

    const gruas = await Grua.findAll({
      include: [
        {
          model: Sucursal,
          include: [
            {
              model: Caja,
              include: [
                {
                  model: Turno_Caja,
                  include: [
                    {
                      model: Usuario,
                      // include: [{ model: Auditoria }],
                    },
                  ],
                },
              ],
            },
            {
              model: Barrera,
              include: [
                {
                  model: Turno_Barrera,
                  include: [{ model: Acarreo }],
                },
              ],
            },
            {
              model: Usuario,
              // include: [{ model: Auditoria }],
            },
          ],
        },
        {
          model: Turno_Grua,
          include: [
            {
              model: Usuario,
              as: "chofer",
              include: [
                { model: Sucursal },
                // { model: Auditoria }
              ],
            },
            {
              model: Usuario,
              as: "enganchador",
              include: [
                { model: Sucursal },
                // { model: Auditoria }
              ],
            },
            {
              model: Usuario,
              as: "supervisor",
              include: [
                { model: Sucursal },
                // { model: Auditoria }
              ],
            },
            {
              model: Acarreo,
              include: [
                { model: Vehiculo },
                {
                  model: Turno_Barrera,
                  include: [
                    {
                      model: Barrera,
                      include: [{ model: Sucursal }],
                    },
                  ],
                },
                {
                  model: Cobro,
                  include: [
                    {
                      model: Turno_Caja,
                      include: [
                        { model: Caja },
                        {
                          model: Usuario,
                          // include: [{ model: Auditoria }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const sucursales = await Sucursal.findAll({
      include: [
        {
          model: Usuario,
          include: [
            // { model: Auditoria },
            {
              model: Turno_Caja,
              include: [
                { model: Caja },
                {
                  model: Cobro,
                  include: [
                    {
                      model: Acarreo,
                      include: [{ model: Vehiculo }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: Caja,
          include: [
            {
              model: Turno_Caja,
              include: [
                {
                  model: Usuario,
                  // include: [{ model: Auditoria }],
                },
                {
                  model: Cobro,
                  include: [
                    {
                      model: Acarreo,
                      include: [
                        { model: Vehiculo },
                        {
                          model: Turno_Grua,
                          include: [
                            { model: Grua },
                            { model: Usuario, as: "chofer" },
                            { model: Usuario, as: "enganchador" },
                            { model: Usuario, as: "supervisor" },
                          ],
                        },
                        {
                          model: Turno_Barrera,
                          include: [{ model: Barrera }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: Grua,
          include: [
            {
              model: Turno_Grua,
              include: [
                {
                  model: Usuario,
                  as: "chofer",
                  // include: [{ model: Auditoria }],
                },
                {
                  model: Usuario,
                  as: "enganchador",
                  // include: [{ model: Auditoria }],
                },
                {
                  model: Usuario,
                  as: "supervisor",
                  // include: [{ model: Auditoria }],
                },
                {
                  model: Acarreo,
                  include: [
                    { model: Vehiculo },
                    {
                      model: Turno_Barrera,
                      include: [{ model: Barrera }],
                    },
                    {
                      model: Cobro,
                      include: [{ model: Turno_Caja }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: Barrera,
          include: [
            {
              model: Turno_Barrera,
              include: [
                {
                  model: Acarreo,
                  include: [
                    { model: Vehiculo },
                    {
                      model: Turno_Grua,
                      include: [
                        { model: Grua },
                        { model: Usuario, as: "chofer" },
                        { model: Usuario, as: "enganchador" },
                        { model: Usuario, as: "supervisor" },
                      ],
                    },
                    {
                      model: Cobro,
                      include: [{ model: Turno_Caja }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const turnosCaja = await Turno_Caja.findAll({
      include: [
        {
          model: Caja,
          include: [
            {
              model: Sucursal,
              include: [{ model: Grua }, { model: Barrera }],
            },
          ],
        },
        {
          model: Usuario,
          include: [
            { model: Sucursal }, // { model: Auditoria }
          ],
        },
        {
          model: Cobro,
          include: [
            {
              model: Acarreo,
              include: [
                { model: Vehiculo },
                {
                  model: Turno_Grua,
                  include: [
                    {
                      model: Grua,
                      include: [{ model: Sucursal }],
                    },
                    {
                      model: Usuario,
                      as: "chofer",
                      include: [
                        { model: Sucursal }, // { model: Auditoria }
                      ],
                    },
                    {
                      model: Usuario,
                      as: "enganchador",
                      include: [
                        { model: Sucursal }, // { model: Auditoria }
                      ],
                    },
                    {
                      model: Usuario,
                      as: "supervisor",
                      include: [
                        { model: Sucursal }, // { model: Auditoria }
                      ],
                    },
                  ],
                },
                {
                  model: Turno_Barrera,
                  include: [
                    {
                      model: Barrera,
                      include: [{ model: Sucursal }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const turnosGrua = await Turno_Grua.findAll({
      include: [
        {
          model: Grua,
          include: [
            {
              model: Sucursal,
              include: [{ model: Barrera }, { model: Caja }],
            },
          ],
        },
        {
          model: Usuario,
          as: "chofer",
          include: [
            { model: Sucursal }, // { model: Auditoria }
          ],
        },
        {
          model: Usuario,
          as: "enganchador",
          include: [
            { model: Sucursal }, // { model: Auditoria }
          ],
        },
        {
          model: Usuario,
          as: "supervisor",
          include: [
            { model: Sucursal }, // { model: Auditoria }
          ],
        },
        {
          model: Acarreo,
          include: [
            { model: Vehiculo },
            {
              model: Turno_Barrera,
              include: [
                {
                  model: Barrera,
                  include: [{ model: Sucursal }],
                },
              ],
            },
            {
              model: Cobro,
              include: [
                {
                  model: Turno_Caja,
                  include: [
                    {
                      model: Caja,
                      include: [{ model: Sucursal }],
                    },
                    {
                      model: Usuario,
                      // include: [{ model: Auditoria }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const turnosBarrera = await Turno_Barrera.findAll({
      include: [
        {
          model: Barrera,
          include: [
            {
              model: Sucursal,
              include: [{ model: Grua }, { model: Caja }],
            },
          ],
        },
        {
          model: Acarreo,
          include: [
            { model: Vehiculo },
            {
              model: Turno_Grua,
              include: [
                {
                  model: Grua,
                  include: [{ model: Sucursal }],
                },
                {
                  model: Usuario,
                  as: "chofer",
                  include: [
                    { model: Sucursal }, // { model: Auditoria }
                  ],
                },
                {
                  model: Usuario,
                  as: "enganchador",
                  include: [
                    { model: Sucursal }, // { model: Auditoria }
                  ],
                },
                {
                  model: Usuario,
                  as: "supervisor",
                  include: [
                    { model: Sucursal }, // { model: Auditoria }
                  ],
                },
              ],
            },
            {
              model: Cobro,
              include: [
                {
                  model: Turno_Caja,
                  include: [
                    {
                      model: Caja,
                      include: [{ model: Sucursal }],
                    },
                    {
                      model: Usuario,
                      // include: [{ model: Auditoria }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    res.json({
      message: "Ruta de prueba funcionando correctamente",
      body: {
        usuarios,
        cajas,
        acarreos,
        cobros,
        barreras,
        vehiculos,
        gruas,
        sucursales,
        turnosCaja,
        turnosGrua,
        turnosBarrera,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

export default router;
