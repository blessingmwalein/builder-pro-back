export default () => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? 'change-me',
    jwtAccessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-refresh',
    jwtRefreshTtl: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  platformAdmin: {
    key: process.env.PLATFORM_ADMIN_KEY ?? '',
    jwtSecret:
      process.env.PLATFORM_ADMIN_JWT_SECRET ??
      'change-me-platform-admin-jwt-secret',
    jwtTtl: process.env.PLATFORM_ADMIN_JWT_TTL ?? '12h',
  },
  redis: {
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  },
  storage: {
    endpoint: process.env.S3_ENDPOINT ?? '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.S3_BUCKET ?? '',
  },
  mail: {
    host: process.env.SMTP_HOST ?? 'mail.wakandasolarsystems.co.zw',
    port: parseInt(process.env.SMTP_PORT ?? '465', 10),
    secure: (process.env.SMTP_SECURE ?? 'true').toLowerCase() === 'true',
    user: process.env.SMTP_USER ?? 'noreply@wakandasolarsystems.co.zw',
    password: process.env.SMTP_PASSWORD ?? '',
    fromName: process.env.SMTP_FROM_NAME ?? 'BuilderPro',
    fromAddress:
      process.env.SMTP_FROM_ADDRESS ?? 'noreply@wakandasolarsystems.co.zw',
    // App URL used when rendering links (accept-invite, reset password, etc.)
    appUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3001',
    enabled: (process.env.MAIL_ENABLED ?? 'true').toLowerCase() === 'true',
  },
});
