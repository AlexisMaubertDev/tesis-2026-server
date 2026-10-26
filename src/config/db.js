import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config();

/**
 * Conexión a la base de datos con doble dialecto.
 *
 * - Desarrollo local: MySQL (`DB_DIALECT=mysql`, el valor por defecto).
 * - Producción: PostgreSQL/Supabase (`DB_DIALECT=postgres`).
 *
 * Se puede configurar con variables sueltas (DB_HOST, DB_PORT, DB_USER,
 * DB_PASSWORD, DB_NAME) o con una única URL (`DB_URL`). La URL es la opción
 * recomendada para Supabase/Vercel porque incluye usuario, contraseña y
 * parámetros de conexión en un solo valor.
 */

const urlConexion = process.env.DB_URL || process.env.DATABASE_URL || "";
const dialectoUrl = urlConexion.startsWith("postgres")
  ? "postgres"
  : urlConexion.startsWith("mysql")
    ? "mysql"
    : null;

const dialecto = (process.env.DB_DIALECT || dialectoUrl || "mysql").replace(
  "postgresql",
  "postgres",
);

const puerto =
  Number(process.env.DB_PORT) || (dialecto === "postgres" ? 5432 : 3306);

// Supabase exige SSL. Si no se indica DB_SSL, se activa automáticamente al
// detectar una URL/host de Supabase; en local queda desactivado.
const hostOSupabase = /supabase\.(co|com)/i.test(
  urlConexion || process.env.DB_HOST || "",
);
const usarSsl =
  process.env.DB_SSL !== undefined
    ? process.env.DB_SSL === "true"
    : hostOSupabase;

// En Vercel cada instancia es efímera: conviene un pool chico para no agotar
// las conexiones de Supabase. En local se mantiene el pool habitual.
const maxPool =
  Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 3 : 10);

const opciones = {
  dialect: dialecto,
  port: puerto,
  logging: process.env.DB_LOGGING === "true" ? console.log : false,
  pool: {
    max: maxPool,
    min: 0,
    acquire: 60000,
    idle: 10000,
  },
  ...(usarSsl
    ? {
        dialectOptions: {
          ssl: {
            require: true,
            // Supabase usa un certificado propio; con esta opción la conexión
            // sigue cifrada sin exigir el bundle de CAs en el runtime.
            rejectUnauthorized: false,
          },
        },
      }
    : {}),
};

const sequelize = urlConexion
  ? new Sequelize(urlConexion, opciones)
  : new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD,
      {
        ...opciones,
        host: process.env.DB_HOST,
      },
    );

export default sequelize;
