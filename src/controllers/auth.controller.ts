import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { UserGoogleDTO } from '../dtos/user-google.dto';
import { GoogleOAuthGuard } from '../strategies/guards/google-oauth.guard';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenService } from 'src/services/refresh-token.service';
import { UserService } from 'src/services/user.service';
import { MapperService } from 'src/services/mapper.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly configService: ConfigService, private readonly refreshTokenService: RefreshTokenService, private readonly userService: UserService, private readonly mapperService: MapperService) { }

    @Get('google')
    @UseGuards(GoogleOAuthGuard)
    async googleLogin() {
    }

    @Get('google/callback')
    @UseGuards(GoogleOAuthGuard)
    async googleLoginCallback(@Req() req: Request & { user: UserGoogleDTO }, @Res() res: Response) {

        const doesUserExists = !!(await this.userService.findUserById(req.user.googleId))
        if (!doesUserExists) {
            const user = this.mapperService.mapToUser(req.user)
            user.coins = +this.configService.get('DEFAULT_COINS')
            await this.userService.createUser(user)
        }

        const refreshToken = this.refreshTokenService.createRefreshCookie(req.user.refreshToken)
        res.setHeader('Set-Cookie', refreshToken);

        const frontUrl = this.configService.get('FRONT_URL');
        return res.redirect(`${frontUrl}?${doesUserExists ? "" : "new=true&"}${"access_token=" + req.user.accessToken}`);
    }

    @Post('google/refresh-token')
    async refreshToken(@Req() req: Request, @Res() res: Response) {

        const refreshToken = req.cookies["refreshToken"];


        if (!refreshToken) {
            return res.status(403).json({ ok: false, message: "There is no refresh token." })
        }
        try {
            const data = await this.refreshTokenService.getRefreshedToken(refreshToken)

            if (data.id_token) {
                return res.json({ ok: true, token: data.access_token });
            } else {
                return res.status(400).json({ ok: false, message: 'Refresh process failed in Google.' });
            }
        } catch (message) {
            return res.status(500).json({ ok: false, message });
        }
    }
}