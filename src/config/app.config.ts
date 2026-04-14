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
});
