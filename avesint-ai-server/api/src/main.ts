import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Read CORS origins from env (CORS_ORIGINS as comma-separated list). Defaults to localhost:5173
  const config = app.get(ConfigService);
  const originsEnv = config.get<string>('CORS_ORIGINS');
  const origins = originsEnv
    ? originsEnv
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : ['http://localhost:5173'];

  app.enableCors({
    origin: origins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = 3000; // фіксуємо 3000 для Nest dev
  await app.listen(port);

  console.log(
    `🚀 Avesint API running on http://localhost:${port}/api with CORS origins: ${origins.join(', ')}`,
  );
}
bootstrap();
