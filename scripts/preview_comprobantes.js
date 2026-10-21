import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { construirComprobantePdf } from "../src/controllers/cobroController.js";

/**
 * Genera comprobantes de cobro de prueba (sin tocar la base de datos) para
 * revisar el diseño del PDF. Los archivos quedan en una carpeta temporal.
 *
 * Uso: node scripts/preview_comprobantes.js [carpeta_salida]
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const carpetaSalida =
  process.argv[2] ||
  path.join(__dirname, "..", "tmp", "comprobantes");

// Comprobantes de ejemplo: cubren distintos casos (pago simple en efectivo,
// pago mixto, con y sin factura, con varias estadías y con datos faltantes).
const ejemplos = [
  {
    archivo: "01-efectivo-sin-factura.pdf",
    cobro: {
      id: "a1b2c3d4-1111-2222-3333-444455556666",
      fecha: new Date("2026-10-20T14:35:00"),
      efectivo: 83000,
      mp: 0,
      total: 83000,
      estadias: 0,
      numero_factura: null,
      Acarreo: {
        fecha_acarreo: new Date("2026-10-20T11:05:00"),
        direccion: "Av. Corrientes 1234, CABA",
        motivo: "Estacionamiento en zona prohibida - Retiro de calzada",
        Vehiculo: {
          patente: "AB123CD",
          marca: "Toyota",
          modelo: "Corolla",
          color: "Blanco",
        },
      },
      Turno_Caja: {
        Caja: { numero_caja: 1, referencia: "sur-001" },
        Usuario: {
          nombre: "Carla",
          apellido: "Gómez",
          dni: "22333444",
          legajo: 1003,
        },
      },
    },
  },
  {
    archivo: "02-mixto-con-factura-estadias.pdf",
    cobro: {
      id: "b2c3d4e5-2222-3333-4444-555566667777",
      fecha: new Date("2026-10-20T18:12:00"),
      efectivo: 40000,
      mp: 141000,
      total: 181000,
      estadias: 2,
      numero_factura: "A-0001 / B-2015",
      Acarreo: {
        fecha_acarreo: new Date("2026-10-18T09:00:00"),
        direccion: "Ruta 8 km 45, San Miguel",
        motivo: "Vehículo abandonado - Traslado a depósito",
        Vehiculo: {
          patente: "AF977KX",
          marca: "Volkswagen",
          modelo: "Amarok",
          color: "Gris",
        },
      },
      Turno_Caja: {
        Caja: { numero_caja: 3, referencia: "sur-003" },
        Usuario: {
          nombre: "Mariano",
          apellido: "Fernández",
          dni: "30111222",
          legajo: 1009,
        },
      },
    },
  },
  {
    archivo: "03-solo-mercado-pago-tope-estadias.pdf",
    cobro: {
      id: "c3d4e5f6-3333-4444-5555-666677778888",
      fecha: new Date("2026-10-20T21:48:00"),
      efectivo: 0,
      mp: 98000,
      total: 98000,
      estadias: 70,
      numero_factura: "B-2015",
      Acarreo: {
        fecha_acarreo: new Date("2026-09-01T08:30:00"),
        direccion: "Colectora Oeste 500, Garín",
        motivo: "Siniestro vial - Traslado por grúa",
        Vehiculo: {
          patente: "TEST001",
          marca: "Ford",
          modelo: "Ranger",
          color: "Negro",
        },
      },
      Turno_Caja: {
        Caja: { numero_caja: 2, referencia: "sur-002" },
        Usuario: {
          nombre: "Lucía",
          apellido: "Ramírez",
          dni: "28777888",
          legajo: 1011,
        },
      },
    },
  },
  {
    archivo: "04-datos-faltantes.pdf",
    cobro: {
      id: "d4e5f6a7-4444-5555-6666-777788889999",
      fecha: new Date("2026-10-20T08:05:00"),
      efectivo: 98000,
      mp: 83000,
      total: 181000,
      estadias: 1,
      numero_factura: null,
      Acarreo: null,
      Turno_Caja: {
        Caja: null,
        Usuario: null,
      },
    },
  },
];

const main = () => {
  fs.mkdirSync(carpetaSalida, { recursive: true });

  ejemplos.forEach(({ archivo, cobro }) => {
    const doc = construirComprobantePdf(cobro);
    const destino = path.join(carpetaSalida, archivo);
    const stream = fs.createWriteStream(destino);

    doc.pipe(stream);
    doc.end();

    stream.on("finish", () => {
      console.log(`Generado: ${destino}`);
    });
  });
};

main();
