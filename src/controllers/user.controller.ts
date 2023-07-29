import { Controller, Get, Headers, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetUserDTO } from 'src/dtos/get_user.dto';
import { UserService } from 'src/services/user.service';
import { Response } from "express"
import "isomorphic-fetch"

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService, private readonly configService: ConfigService) { }

    @Get("")
    async getMe(@Headers('Authorization') header: string, @Res() res: Response) {
        if (!header) return res.sendStatus(401)

        const data = await this.userService.getUser(header)
        if (data?.error && data.error?.code) {
            return res.sendStatus(401)
        }

        const avatar = data.photos && data.photos.length > 0 ? data.photos[0].url : null;
        const googleId = data.names && data.names.length > 0 ? data.names[0].metadata.source.id : null;
        const userDB = await this.userService.findUserById(googleId)
        const user: GetUserDTO = {
            ...userDB,
            avatar
        }

        return res.json(user);
    }

}
