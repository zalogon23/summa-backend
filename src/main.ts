import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  dotenv.config();

  const config = app.get(ConfigService)

  app.enableCors({
    origin: config.get("FRONT_URL"),
    credentials: true,
  });
  app.use(cookieParser())
  await app.listen(config.get("PORT"));
}
bootstrap();