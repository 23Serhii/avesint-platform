// src/tasks/task.entity.ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', default: 'new' })
  status!: string;

  @Column({ type: 'text', default: 'medium' })
  priority!: string;

  @Column({ type: 'text', nullable: true })
  role!: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigneeId!: string | null;

  @Column({ type: 'text', nullable: true })
  assigneeCallsign!: string | null;

  @Column({ type: 'text', nullable: true })
  assigneeRank!: string | null;

  @Column({ type: 'text', nullable: true })
  assigneeUnit!: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  eventId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  parentTaskId!: string | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @Column({ type: 'boolean', default: false })
  archived!: boolean;
}
