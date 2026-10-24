export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3000', 10) || 3000,
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  mobileAppScheme: process.env.MOBILE_APP_SCHEME || 'barivara',
  redis: {
    url: process.env.REDIS_URL || undefined,
  },
  supabase: {
    // undefined when unset — ReloadStorageService checks isConfigured() before use
    url: process.env.SUPABASE_URL || undefined,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  },
  fileUpload: {
    maxImageSizeBytes:
      parseInt(process.env.MAX_IMAGE_SIZE_MB ?? '5', 10) * 1024 * 1024,
    maxDocumentSizeBytes:
      parseInt(process.env.MAX_DOCUMENT_SIZE_MB ?? '10', 10) * 1024 * 1024,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT ?? '465', 10) || 465,
    secure:
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === 'true'
        : (parseInt(process.env.SMTP_PORT ?? '465', 10) || 465) === 465,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from:
      process.env.SMTP_FROM ||
      (process.env.SMTP_USER ? `BariVara <${process.env.SMTP_USER}>` : undefined),
  },
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT ?? '465', 10) || 465,
  SMTP_SECURE:
    process.env.SMTP_SECURE !== undefined
      ? process.env.SMTP_SECURE === 'true'
      : (parseInt(process.env.SMTP_PORT ?? '465', 10) || 465) === 465,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM:
    process.env.SMTP_FROM ||
    (process.env.SMTP_USER ? `BariVara <${process.env.SMTP_USER}>` : undefined),
});
