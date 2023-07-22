import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config'; // If you're using NestJS ConfigModule

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
      scope: ["email", "profile", "openid"]
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    const { id, displayName, emails, photos } = profile;

    // You can perform additional validation or user registration logic here
    // For example, check if the user exists in your database or create a new user.

    const user = {
      googleId: id,
      displayName,
      email: emails?.[0]?.value,
      profilePhoto: photos?.[0]?.value,
      accessToken,
      refreshToken
    };

    done(null, user);
  }
}