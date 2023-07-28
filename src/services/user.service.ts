import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { UserDTO } from 'src/dtos/create-user.dto';
import { User } from 'src/entities';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
    constructor(@InjectRepository(User) private userRepository: Repository<User>, private readonly configService: ConfigService) { }

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

    async findUserById(id: string) {
        try {
            return await this.userRepository.findOneBy({ id })
        } catch (err) {
            console.log(err)
            return null
        }
    }

    async hasEnoughCoins(coins: number, id: string): Promise<boolean> {
        try {
            const user = await this.userRepository.findOneBy({ id })
            if (!user || user.coins < coins) return false
            return true
        } catch (err) {
            console.log(err)
            return false
        }
    }

    async spend(coins: number, id: string): Promise<boolean> {
        try {
            const user = await this.userRepository.findOneBy({ id })
            if (!this.hasEnoughCoins(coins, id)) return false
            user.coins -= coins
            await this.userRepository.save(user);
        } catch (err) {
            console.log(err)
            return false
        }
    }

    async getUser(header: string) {
        try {
            console.log("Received Authorization Header: " + header)

            const apiKey = this.configService.get("API_KEY")
            const response = await fetch(`https://people.googleapis.com/v1/people/me?personFields=names,photos&key=${apiKey}`, {
                headers: {
                    "Authorization": header,
                },
            })
            const data = await response.json()
            return data
        } catch (err) {
            console.log(err)
            return null
        }
    }
}