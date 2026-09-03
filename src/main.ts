import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createCorsOptions } from './config/cors.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security Headers
  app.use(helmet());

  // Global Prefix
  app.setGlobalPrefix('api/v1');

  app.enableCors(createCorsOptions());

  // Global Validation & Transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global Filters & Interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger / OpenAPI Documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('BariVara API (বাড়িভাড়া)')
      .setDescription(
        'Bangla-first rental & property rent management backend REST API powering Web and Mobile applications.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
    logger.log(`Swagger documentation available at /api/docs`);
  }

  const port = process.env.PORT || 3000;

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 BariVara Backend running on http://localhost:${port}/api/v1`);
}

bootstrap();
