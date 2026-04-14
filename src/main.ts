import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const defaultOrigins = [
    'https://builder-pro-web.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ];
  const envOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Builder Pro API')
    .setDescription('Multi-tenant Construction Project Management Platform API')
    .setVersion('1.0.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-tenant-slug',
        description: 'Tenant slug required for all protected endpoints',
      },
      'tenant-slug',
    )
    .addBearerAuth()
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Platform admin JWT token for /platform-admin endpoints',
      },
      'platform-admin-bearer',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-platform-admin-key',
        description:
          'Platform admin API key for /platform-admin endpoints (alternative to bearer)',
      },
      'platform-admin-key',
    )
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
