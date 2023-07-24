import { IsEmail, IsNotEmpty, MinLength } from "class-validator";

export class UserDTO {

    @IsNotEmpty()
    id: string;

    @IsNotEmpty()
    @MinLength(5)
    username: string;

    description: string;
}