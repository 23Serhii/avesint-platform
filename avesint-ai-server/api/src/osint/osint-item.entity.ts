// api/src/osint/osint-item.entity.ts
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { OsintSourceEntity } from './osint-source.entity';

@Entity('osint_items')
export class OsintItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => OsintSourceEntity, (source) => source.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'source_id' })
  source!: OsintSourceEntity;

  // автоматично мапиться на колонку source_id, яку створює @ManyToOne + @JoinColumn
  @RelationId((item: OsintItemEntity) => item.source)
  sourceId!: string;

  // "telegram:ChDambiev:987654"
  @Column({ unique: true })
  @Index()
  externalId!: string;

  // text | video | image | infra | other
  @Column({ type: 'text' })
  kind!: 'text' | 'video' | 'image' | 'infra' | 'other';

  @Column({ type: 'text', nullable: true })
  url?: string | null;

  // Загальний рейтинг джерела (на майбутнє)
  @Column({ type: 'float', default: 0.5 })
  reliability!: number;

  @Column({ type: 'text', nullable: true })
  title?: string | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({ type: 'text', nullable: true })
  summary?: string | null;

  @Column({ type: 'text', nullable: true })
  language?: string | null;

  @Column({ type: 'text', nullable: true })
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;

  @Column({ type: 'text', nullable: true })
  type?: string | null;

  @Column({ type: 'text', nullable: true })
  category?: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  tags?: string[] | null;

  @Column({ type: 'float', nullable: true })
  credibility?: number | null;

  @Column({ type: 'timestamptz' })
  parseDate!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  eventDate?: Date | null;

  @Column({ type: 'text', nullable: true })
  rawUrl?: string | null;

  @Column({ type: 'text', nullable: true })
  mediaUrl?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown> | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()', onUpdate: 'now()' })
  updatedAt!: Date;
}
