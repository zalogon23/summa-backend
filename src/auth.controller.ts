import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { GoogleStrategy } from './google.strategy';
import { UserDTO } from './dtos/user.interface';
import * as cookie from "cookie";
import { GoogleOAuthGuard } from './google-oauth.guard';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
    constructor(private readonly googleStrategy: GoogleStrategy, private readonly configService: ConfigService) { }

    @Get('google')
    @UseGuards(GoogleOAuthGuard)
    async googleLogin() {
    }

    @Get('google/callback')
    @UseGuards(GoogleOAuthGuard)
    async googleLoginCallback(@Req() req: Request & { user: UserDTO }, @Res() res: Response) {
        const user = req.user;

        const cookieOptions = {
            httpOnly: true,
            expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            domain: 'localhost',
            path: '/',
        };
        const refreshToken = cookie.serialize('refreshToken', user.refreshToken, cookieOptions);

        console.log(user)

        res.setHeader('Set-Cookie', refreshToken);

        return res.redirect(`http://localhost:3000?token=${user.googleId}`);
    }

    @Post('google/refresh-token')
    async refreshToken(@Req() req: Request, @Res() res: Response) {
        const refreshToken = req.cookies["refreshToken"];
        if (!refreshToken) {
            res.status(401).json({ error: "There is no refresh token." })
        }
        try {
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

            const data = await response.json();

            if (data.id_token) {
                res.json({ token: data.id_token });
            } else {
                res.status(400).json({ error: 'Failed to refresh access token' });
            }
        } catch (error) {
            res.status(500).json({ error });
        }
    }
}