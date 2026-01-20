import { NestFactory } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });

  // Increase body size limit for profile picture uploads
  app.use(require('body-parser').json({ limit: '10mb' }));
  app.use(require('body-parser').urlencoded({ limit: '10mb', extended: true }));

  // Enable CORS for frontend
  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  });

  // Enable compression
  app.use(compression());

  // Global validation pipe
  app.useGlobalPipes(new ZodValidationPipe());

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('UniFlow API')
    .setDescription('Course tracking and seat notification system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 Swagger docs available at http://localhost:${port}/api`);
}

bootstrap();
