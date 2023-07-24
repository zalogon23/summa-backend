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
        console.log(header)
        if (!header) return res.sendStatus(401)

        const apiKey = this.configService.get("API_KEY")
        const response = await fetch(`https://people.googleapis.com/v1/people/me?personFields=names,photos&key=${apiKey}`, {
            headers: {
                "Authorization": header,
            },
        })
        const data = await response.json()
        console.log("data: " + JSON.stringify(data))
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
