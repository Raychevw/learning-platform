import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { CourseModule } from './course.module.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
  const logger = new Logger('CourseServiceBootstrap');
  const app = await NestFactory.create(CourseModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Course Service API')
    .setDescription('Course Bounded Context: Course catalog, syllabus, and publishing contracts')
    .setVersion('1.0.0')
    .addTag('Courses')
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
      path.join(contractsDir, 'course-service-api.json'),
      JSON.stringify(document, null, 2),
    );
    logger.log(`Exported OpenAPI contract to contracts/course-service-api.json`);
  } catch (err) {
    logger.warn(`Could not write contract file: ${(err as Error).message}`);
  }

  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Course Service running on http://localhost:${port}`);
  logger.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('Fatal error starting Course Service:', err);
});
