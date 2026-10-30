import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('LMSModularMonolith');
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Університетська LMS Studevo API')
    .setDescription(
      'Модульний моноліт внутрішньої університетської платформи дистанційного навчання (LMS). ' +
      'Модулі: Auth & SSO, Users & Academic Groups, Course Catalog & Syllabus, Assignments & Rubrics, ' +
      'Grading & Gradebook, Webinars & Online Classes, Security Audit Logs.'
    )
    .setVersion('2.0.0')
    .addTag('Auth & SSO')
    .addTag('Academic Groups & Users')
    .addTag('Courses & Modules (LMS)')
    .addTag('Assignments, Rubrics & Submissions')
    .addTag('Grading & Electronic Gradebook')
    .addTag('Webinars & Sync Online Classes')
    .addTag('Audit')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`========================================================================`);
  logger.log(`🎓 University LMS Modular Monolith Backend running on http://localhost:${port}`);
  logger.log(`📚 Swagger OpenAPI Documentation: http://localhost:${port}/api/docs`);
  logger.log(`========================================================================`);
}

await bootstrap();
