// api/src/osint/osint-source.entity.ts
import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OsintItemEntity } from './osint-item.entity';

/**
 * Джерело OSINT:
 * - конкретний Telegram-канал, користувач, сайт, RSS, Twitter/X і т.д.
 */
@Entity('osint_sources')
export class OsintSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Унікальний зовнішній ID джерела, що приходить від парсерів (наприклад "telegram:ChDambiev")
  @Column({ type: 'text', unique: true })
  @Index()
  externalId!: string;

  // Людська назва джерела (наприклад "Rybar", "DeepState", "ISW")
  @Column({ type: 'text' })
  @Index()
  name!: string;

  /**
   * Тип джерела:
   * - telegram_channel
   * - telegram_chat
   * - website
   * - twitter
   * - rss
   * - youtube
   * - other
   */
  @Column({ type: 'text', nullable: true })
  type?: string | null;

  /**
   * Базовий URL джерела:
   * - https://t.me/rybar
   * - https://twitter.com/something
   * - https://example.com
   */
  @Column({ type: 'text', nullable: true })
  url?: string | null;

  /**
   * Умовний "handle" / логін / ідентифікатор:
   * - rybar
   * - DeepState
   * - @some_channel
   */
  @Column({ type: 'text', nullable: true })
  handle?: string | null;

  // Мова основного контенту джерела
  @Column({ type: 'text', nullable: true })
  language?: string | null;

  // Чи активне джерело (використовується в парсерах)
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Загальний рейтинг джерела (0..1, наприклад 0.5 за замовчуванням)
  @Column({ type: 'float', default: 0.5 })
  reliability!: number;

  // Загальна кількість OSINT-айтемів від цього джерела
  @Column({ type: 'integer', default: 0 })
  totalItems!: number;

  // Скільки айтемів з цього джерела потім підтвердили (пізніше оновимо з ревʼю)
  @Column({ type: 'integer', default: 0 })
  confirmedItems!: number;

  // Скільки айтемів з цього джерела потім спростували
  @Column({ type: 'integer', default: 0 })
  disprovedItems!: number;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  // Категорія джерела: "enemy-prop" | "official" | ...
  @Column({ type: 'text', nullable: true })
  category?: string | null;

  // Теги для фільтрації (наприклад, ['ru-propaganda', 'front-south'])
  @Column({ type: 'text', array: true, nullable: true })
  tags?: string[] | null;

  // Будь-які додаткові дані по джерелу (налаштування парсера, токени і т.д. — без сек’юрних штук)
  @Column({ type: 'jsonb', nullable: true })
  meta?: Record<string, unknown> | null;

  // Зв’язок з айтемами цього джерела
  @OneToMany(() => OsintItemEntity, (item) => item.source)
  items!: OsintItemEntity[];

  @Column({ type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;

  @Column({ type: 'timestamptz', default: () => 'now()', onUpdate: 'now()' })
  updatedAt!: Date;
}
