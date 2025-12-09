// src/users/users.service.ts
import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from './role.enum';
import type { UserDto, UserStatus } from './dto/user.dto';
import { mapUserToDto } from './dto/user.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  status?: UserStatus[];
  roles?: Role[];
  username?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly auditLog: AuditLogService,
  ) {}

  async create(dto: CreateUserDto, role: Role = Role.USER): Promise<User> {
    const existing = await this.usersRepo.findOne({
      where: { callsign: dto.callsign },
    });
    if (existing) {
      throw new ConflictException('User with this callsign already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepo.create({
      callsign: dto.callsign,
      passwordHash,
      displayName: dto.displayName ?? dto.callsign,
      role,
    });

    const saved = await this.usersRepo.save(user);

    await this.auditLog.log({
      actorId: null,
      actorCallsign: null,
      actorRole: null,
      action: 'user_created',
      severity: 'info',
      target: `user:${saved.id}`,
      description: `Створено користувача з позивним "${saved.callsign}"`,
    });

    return saved;
  }

  findByCallsign(callsign: string) {
    return this.usersRepo.findOne({ where: { callsign } });
  }

  findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  async setTwoFactorSecret(id: string, secret: string) {
    await this.usersRepo.update(id, { twoFactorSecret: secret });
  }

  async enableTwoFactor(id: string) {
    await this.usersRepo.update(id, { isTwoFactorEnabled: true });
  }

  async setRole(id: string, role: Role, actorCallsign?: string) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    const oldRole = user.role;
    user.role = role;
    const saved = await this.usersRepo.save(user);

    await this.auditLog.log({
      actorId: null,
      actorCallsign: actorCallsign ?? null,
      actorRole: null,
      action: 'role_changed',
      severity: 'warning',
      target: `user:${saved.id}`,
      description: `Змінено роль користувача "${saved.callsign}" з ${oldRole} на ${role}`,
    });

    return saved;
  }

  async list(params: ListUsersParams): Promise<{
    items: UserDto[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 100);
    const qb = this.usersRepo.createQueryBuilder('u');

    // Фільтр за username: по callsign + displayName
    if (params.username && params.username.trim().length > 0) {
      const text = `%${params.username.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(u.callsign) LIKE :text OR LOWER(u.displayName) LIKE :text)',
        { text },
      );
    }

    // Фільтр за ролями
    if (params.roles && params.roles.length > 0) {
      qb.andWhere('u.role IN (:...roles)', { roles: params.roles });
    }

    // Фільтр за статусом:
    // зараз у нас тільки "active" => якщо фільтр не включає 'active' – повертаємо пустий список
    if (params.status && params.status.length > 0) {
      if (!params.status.includes('active')) {
        return { items: [], page, pageSize, total: 0 };
      }
    }

    const [users, total] = await qb
      .orderBy('u.callsign', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const items = users.map(mapUserToDto);

    return { items, page, pageSize, total };
  }
}
