import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AssignmentModule } from './assignment.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const logger = new Logger('AssignmentServiceBootstrap');
  const app = await NestFactory.create(AssignmentModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Assignment & Student Service API')
    .setDescription('Assignment Bounded Context: Student profiles, assignment submission, and grading contracts')
    .setVersion('1.0.0')
    .addTag('Assignments')
    .addTag('Students')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Write machine-readable OpenAPI spec to contracts directory
  try {
    const contractsDir = path.resolve(__dirname, '../../../contracts');
    if (!fs.existsSync(contractsDir)) {
      fs.mkdirSync(contractsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(contractsDir, 'assignment-service-api.json'),
      JSON.stringify(document, null, 2),
    );
    logger.log(`Exported OpenAPI contract to contracts/assignment-service-api.json`);
  } catch (err) {
    logger.warn(`Could not write contract file: ${(err as Error).message}`);
  }

  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`Assignment Service running on http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Assignment Service:', err);
});
