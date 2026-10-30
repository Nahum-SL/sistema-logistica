import dotenv from "dotenv";
import { z } from "zod";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ quiet: true });
}

// Texto vacío en el .env (VARIABLE=) se trata como "no definida".
const optionalString = z
  .string()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]),

  PORT: z.coerce.number().int().positive().default(3000),

  // Servidor local por HTTP, p. ej. http://192.168.1.50:3000
  CORS_ORIGIN: z.url(),
  PUBLIC_APP_URL: z.url(),

  // Saltos de proxy inverso delante de Node. 0 = acceso directo por la red local (lo normal aquí).
  // Con un valor mayor a 0 sin proxy real, un cliente podría falsear su IP y evadir el límite de login.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),

  JWT_SECRET: z.string().min(32),
  // Duración del token en segundos (28800 = 8 horas).
  JWT_EXPIRES_IN: z.coerce.number().int().positive(),

  // Google Drive (OAuth con cuenta personal). Opcionales hasta construir ese módulo.
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GOOGLE_REFRESH_TOKEN: optionalString,
  GOOGLE_DRIVE_ROOT_FOLDER_ID: optionalString,
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Variables de entorno inválidas:");

  console.error(
    parsedEnv.error.issues.map((issue) => ({
      variable: issue.path.join("."),
      mensaje: issue.message,
    })),
  );

  process.exit(1);
}

export const env = parsedEnv.data;

/** Indica si Drive está configurado por completo (para activar o no sus rutas). */
export const driveConfigured = Boolean(
  env.GOOGLE_CLIENT_ID &&
  env.GOOGLE_CLIENT_SECRET &&
  env.GOOGLE_REFRESH_TOKEN &&
  env.GOOGLE_DRIVE_ROOT_FOLDER_ID,
);
