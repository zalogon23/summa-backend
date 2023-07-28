import { Injectable } from '@nestjs/common';
import { UserGoogleDTO } from 'src/dtos/user-google.dto';
import { User } from 'src/entities';

@Injectable()
export class MapperService {
    mapToUser(user: UserGoogleDTO): User {
        return {
            id: user.googleId,
            username: user.displayName,
            description: "",
            coins: 0
        }
    }
}
