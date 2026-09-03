import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const LOCAL_DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
  'http://localhost:19006',
];

function configuredOrigins(frontendUrl?: string): string[] {
  return (frontendUrl || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function createCorsOptions(
  nodeEnv = process.env.NODE_ENV || 'development',
  frontendUrl = process.env.FRONTEND_URL,
): CorsOptions {
  const allowedOrigins = new Set([
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
