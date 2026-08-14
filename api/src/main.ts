import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // The web frontend (havenote.health / app.havenote.health) and the API
  // (api.havenote.health) are different origins — without this, every
  // request from the browser fails CORS before it even reaches a
  // controller. Both the apex and app. subdomain serve the same frontend
  // (see web-hosting-stack.ts / dns-stack.ts), so both need to be allowed.
  // localhost:5173 covers local frontend dev against the live API.
  app.enableCors({
    origin: ['https://havenote.health', 'https://app.havenote.health', 'http://localhost:5173'],
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
