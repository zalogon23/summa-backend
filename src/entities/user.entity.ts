import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class User {
    @PrimaryColumn({
        name: 'user_id',
    })
    id: string;

    @Column({
        nullable: false,
        default: '',
    })
    username: string;

    @Column({
        nullable: false,
        default: '',
    })
    description: string;

    @Column({
        nullable: false,
        default: 0,
    })
    coins: number;
}