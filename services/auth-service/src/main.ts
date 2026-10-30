import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AuthModule } from './auth.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const logger = new Logger('AuthServiceBootstrap');
  const app = await NestFactory.create(AuthModule);

  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Auth & Identity Service API')
    .setDescription('Аутентифікація, випуск JWT, керування користувачами та ролями')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('Auth & Identity')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  try {
    const contractsDir = path.resolve(__dirname, '../../../contracts');
    if (!fs.existsSync(contractsDir)) fs.mkdirSync(contractsDir, { recursive: true });
    fs.writeFileSync(
      path.join(contractsDir, 'auth-service-api.json'),
      JSON.stringify(document, null, 2),
    );
    logger.log('Exported OpenAPI contract to contracts/auth-service-api.json');
  } catch (err) {
    logger.warn(`Could not write contract file: ${(err as Error).message}`);
  }

  const port = Number(process.env.PORT || 3003);
  await app.listen(port);
  logger.log(`Auth Service running on http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Auth Service:', err);
  process.exit(1);
});
