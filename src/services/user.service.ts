import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { UserDTO } from 'src/dtos/user.dto';
import { User } from 'src/entities';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
    ) { }

    async createUser(createUserDto: UserDTO) {
        try {
            const result = await this.userRepository
                .createQueryBuilder()
                .insert()
                .into(User)
                .values(createUserDto)
                .execute()
            console.log(result)
        } catch (err) {
            console.log(err)
        }
    }

    findUserById(id: string) {
        return this.userRepository.findOneBy({ id });
    }
}