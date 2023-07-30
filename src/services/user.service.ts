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
            console.log(`User: ${JSON.stringify(user)}`)
            console.log(`User coins: ${user.coins}`)
            console.log(`Necessary coins: ${coins}`)
            console.log(`Has enough funds? ${user && (user.coins > coins)}`)
            const hasEnoughCoins = user && (user.coins > coins)
            console.log(`UserService.hasEnoughCoins: ${hasEnoughCoins}`)
            if (!hasEnoughCoins) {
                return false
            }
            return true
        } catch (err) {
            console.log(err)
            return false
        }
    }

    async spend(coins: number, id: string): Promise<boolean> {
        try {
            const hasEnoughCoins = await this.hasEnoughCoins(coins, id)
            if (!hasEnoughCoins) {
                return false
            }
            const user = await this.userRepository.findOneBy({ id })
            console.log("current coins: " + user.coins)
            console.log("spending coins: " + coins)
            user.coins -= coins
            console.log("after spending coins: " + user.coins)
            console.log(JSON.stringify(user))
            await this.userRepository.save(user);
            return true
        } catch (err) {
            console.log(err)
            return false
        }
    }

    async getUser(header: string) {
        try {

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