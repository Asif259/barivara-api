import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const LOCAL_DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
  'http://localhost:19006',
];

const PRODUCTION_ORIGINS = ['https://barivara-web.vercel.app'];

function configuredOrigins(frontendUrl?: string): string[] {
  return (frontendUrl || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Builds CORS options from explicitly passed values.
 * Parameters are supplied by main.ts via ConfigService — no direct process.env access here.
 */
export function createCorsOptions(
  nodeEnv: string = 'development',
  frontendUrl?: string,
): CorsOptions {
  const allowedOrigins = new Set([
    ...PRODUCTION_ORIGINS,
    ...configuredOrigins(frontendUrl),
    ...(nodeEnv === 'production' ? [] : LOCAL_DEVELOPMENT_ORIGINS),
  ]);

  return {
    origin(origin, callback) {
      // Non-browser clients such as mobile apps and server-to-server jobs do not send Origin.
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Accept-Language',
      'X-Requested-With',
    ],
  };
}
