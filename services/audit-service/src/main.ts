import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AuditModule } from './audit.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const logger = new Logger('AuditServiceBootstrap');
  const app = await NestFactory.create(AuditModule);

  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Audit & Security Service API')
    .setDescription('Неизменяемый журнал событий безопасности: вход, изменения данных, отказы в доступе')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Audit & Security')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  try {
    const contractsDir = path.resolve(__dirname, '../../../contracts');
    if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });
    fs.writeFileSync(
      path.join(contractsDir, 'audit-service-api.json'),
      JSON.stringify(document, null, 2),
    );
    logger.log('Exported OpenAPI contract to contracts/audit-service-api.json');
  } catch (err) {
    logger.warn(`Could not write contract file: ${(err as Error).message}`);
  }

  const port = Number(process.env.PORT || 3004);
  await app.listen(port);
  logger.log(`Audit Service running on http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Audit Service:', err);
  process.exit(1);
});
