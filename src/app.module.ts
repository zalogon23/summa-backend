import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './controllers/auth.controller';
import { GoogleStrategy } from './strategies/google.strategy';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import entities, { User } from './entities';
import { RefreshTokenService } from './services/refresh-token.service';
import { MapperService } from './services/mapper.service';
import { UserService } from './services/user.service';
import { UserController } from './controllers/user.controller';
import { VideoController } from './controllers/video.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PassportModule
  ],
  controllers: [AuthController, UserController, VideoController],
  providers: [GoogleStrategy, RefreshTokenService, UserService, MapperService],
})
export class AppModule { }