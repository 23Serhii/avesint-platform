// src/targets/target.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('targets')
export class Target {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  type!: string | null;

  @Column({ type: 'text' })
  status!: string;

  @Column({ type: 'text', nullable: true })
  priority!: string | null;

  @Column('numeric', { precision: 9, scale: 6, nullable: true })
  latitude!: number | null;

  @Column('numeric', { precision: 9, scale: 6, nullable: true })
  longitude!: number | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  firstSeenAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  lastSeenAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @Column({ type: 'boolean', default: false })
  archived!: boolean;
}
