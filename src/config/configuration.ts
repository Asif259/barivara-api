export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  mobileAppScheme: process.env.MOBILE_APP_SCHEME || 'barivara',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  fileUpload: {
    maxImageSizeBytes:
      parseInt(process.env.MAX_IMAGE_SIZE_MB || '5', 10) * 1024 * 1024,
    maxDocumentSizeBytes:
      parseInt(process.env.MAX_DOCUMENT_SIZE_MB || '10', 10) * 1024 * 1024,
  },
  logLevel: process.env.LOG_LEVEL || 'info',
});
