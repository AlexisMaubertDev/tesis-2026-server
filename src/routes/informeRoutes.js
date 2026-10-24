import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  generarInformeMovimientosPdf,
  obtenerMovimientos,
  obtenerInformeTurnoSucursal,
  generarInformeTurnoSucursalPdf,
  obtenerInformeFinTurno,
  generarInformeFinTurnoPdf,
} from "../controllers/informeController.js";

const router = express.Router();

// Informes del sistema.
//   - Movimientos de autos (RF19 / RF20): `tipo=ENTRADA|SALIDA`. Los ve
//     cualquier usuario autenticado; el alcance lo define su sucursal.
//   - Cobros (RF21 / CU12): `tipo=COBRO`. Sólo Cajero, Supervisor y Sistemas
//     (el controlador responde `403` al resto).
//
// En ambos casos Sistemas (que administra todas) puede acotar a una sucursal
// con el parámetro `sucursal`, y el rango de fechas es opcional (si no se
// pasa, se usa el "turno actual" del usuario, según su rol).
router.get("/movimientos", authMiddleware, obtenerMovimientos);
router.get("/movimientos.pdf", authMiddleware, generarInformeMovimientosPdf);

// Informe consolidado de la sucursal (RF15 / CU13): en un mismo turno, los
// cobros de las cajas, los movimientos de las barreras y los acarreos de las
// grúas. Sólo supervisor y sistemas (`fecha` = AAAA-MM-DD, `turno` = 1|2|3).
router.get("/consolidado", authMiddleware, obtenerInformeTurnoSucursal);
router.get("/consolidado.pdf", authMiddleware, generarInformeTurnoSucursalPdf);

// Informe detallado de fin de turno: todos los movimientos de la sucursal en
// una ventana de tiempo. Sólo supervisor y sistemas.
//   - `periodo=MANANA|TARDE|NOCHE` + `fecha=AAAA-MM-DD` (07-15, 15-23, 23-07).
//   - `periodo=RANGO` + `desde`/`hasta` (AAAA-MM-DD) y horas opcionales.
//   - `sucursal` es obligatorio para Sistemas.
router.get("/fin-turno", authMiddleware, obtenerInformeFinTurno);
router.get("/fin-turno.pdf", authMiddleware, generarInformeFinTurnoPdf);

export default router;
