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
            this.userService.createUser(user)
        }

        const refreshToken = this.refreshTokenService.createRefreshCookie(req.user.refreshToken)
        res.setHeader('Set-Cookie', refreshToken);

        const frontUrl = this.configService.get('FRONT_URL');
        return res.redirect(`${frontUrl}${doesUserExists ? "" : "?new=true"}`);
    }

    @Post('google/refresh-token')
    async refreshToken(@Req() req: Request, @Res() res: Response) {

        const refreshToken = req.cookies["refreshToken"];

        if (!refreshToken) {
            res.status(401).json({ error: "There is no refresh token." })
        }
        try {
            const data = await this.refreshTokenService.getRefreshedToken(refreshToken)

            if (data.id_token) {
                res.json({ token: data.id_token });
            } else {
                res.status(400).json({ error: 'Refresh process failed in Google.' });
            }
        } catch (error) {
            res.status(500).json({ error });
        }
    }
}