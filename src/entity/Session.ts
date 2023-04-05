import {
    Entity,
    PrimaryColumn,
    Column,
    BeforeInsert,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity()
export class Session {
    @BeforeInsert()
    generateId() {
        if (!this.id) {
            // Add "n" prefix to identify this ID as a Session
            this.id = 'n' + uuidv4();
        }
    }
    @PrimaryColumn()
    id?: string;

    @Column()
    tokenHash?: string;

    @Column({default: null, nullable: true})
    client?: string;
    @Column()
    userId?: string;
    @Column()
    email?: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt?: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt?: Date;
}
