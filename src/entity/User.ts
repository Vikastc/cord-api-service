import {
    Entity,
    PrimaryColumn,
    Column,
    BeforeInsert,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
    ManyToOne,
    JoinTable,
    Unique,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Session } from './Session';

@Entity()
export class User {
    @BeforeInsert()
    generateId() {
        if (!this.id) {
            // Add "u" prefix to identify this ID as a User ID
            this.id = 'u' + uuidv4();
        }
    }
    @PrimaryColumn()
    id?: string;

    @Column()
    active?: boolean;

    @Column()
    name?: string;

    @Column()
    email?: string;

    @Column({ default: false })
    emailVerified?: boolean;

    @Column({ default: false })
    termsAccepted?: boolean;

    @Column({ nullable: true, default: null })
    emailVerifyHash?: string;

    @Column('simple-json', { default: null, nullable: true })
    details?: {};

    @Column({ default: null, nullable: true })
    mnemonic?: string;

    @Column({ default: null, nullable: true })
    did?: string;

    @Column({ default: null, nullable: true })
    didName?: string;

    @CreateDateColumn({ name: 'created_at' })
    createdAt?: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt?: Date;
}
