import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import "isomorphic-fetch"
import * as cookie from "cookie";

@Injectable()
export class RefreshTokenService {
    constructor(private readonly configService: ConfigService) { }

    createRefreshCookie(refreshToken: string) {
        const cookieOptions: cookie.CookieSerializeOptions = {
            httpOnly: true,
            expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            domain: this.configService.get("FRONT_DOMAIN"),
            path: '/',
            secure: true,
            sameSite: "none"
        };
        const refreshTokenCookie = cookie.serialize('refreshToken', refreshToken, cookieOptions);
        return refreshTokenCookie
    }

    async getRefreshedToken(refreshToken: string) {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                client_id: this.configService.get('GOOGLE_CLIENT_ID'),
                client_secret: this.configService.get('GOOGLE_CLIENT_SECRET'),
                refresh_token: refreshToken,
            }),
        });

        return await response.json();
    }
}
