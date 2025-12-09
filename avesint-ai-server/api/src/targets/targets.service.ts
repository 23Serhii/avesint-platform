// src/targets/targets.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Target } from './target.entity';
import type { TargetDto, TargetPriority, TargetStatus } from './dto/target.dto';
import { mapTargetToDto } from './dto/target.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

export interface ListTargetsParams {
  page?: number;
  pageSize?: number;
  status?: TargetStatus[];
  priority?: TargetPriority[];
  type?: string[];
  search?: string;
  archived?: boolean;
}

export interface CreateTargetInput {
  title: string;
  description?: string;
  type?: string;
  status: TargetStatus;
  priority?: TargetPriority;
  latitude?: number;
  longitude?: number;
}

export type UpdateTargetInput = Partial<CreateTargetInput>;

@Injectable()
export class TargetsService {
  constructor(
    @InjectRepository(Target)
    private readonly targetsRepo: Repository<Target>,
    private readonly auditLog: AuditLogService,
  ) {}

  async list(params: ListTargetsParams): Promise<{
    items: TargetDto[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 100);

    const qb = this.targetsRepo.createQueryBuilder('t');

    // показуємо архів / неархів залежно від прапорця
    if (params.archived === true) {
      qb.andWhere('t.archived = true');
    } else {
      qb.andWhere('t.archived = false');
    }

    if (params.status?.length) {
      qb.andWhere('t.status IN (:...status)', { status: params.status });
    }

    if (params.priority?.length) {
      qb.andWhere('t.priority IN (:...priority)', {
        priority: params.priority,
      });
    }

    if (params.type?.length) {
      qb.andWhere('t.type IN (:...types)', { types: params.type });
    }

    if (params.search && params.search.trim().length > 0) {
      const text = `%${params.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(t.title) LIKE :text OR LOWER(t.description) LIKE :text OR LOWER(t.type) LIKE :text)',
        { text },
      );
    }

    const [items, total] = await qb
      .orderBy('t.lastSeenAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: items.map(mapTargetToDto),
      page,
      pageSize,
      total,
    };
  }

  async getById(id: string): Promise<TargetDto> {
    const target = await this.targetsRepo.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Target not found');
    }
    return mapTargetToDto(target);
  }

  async create(
    input: CreateTargetInput,
    actor?: JwtPayload,
  ): Promise<TargetDto> {
    const now = new Date();
    const entity = this.targetsRepo.create({
      title: input.title,
      description: input.description ?? null,
      type: input.type ?? null,
      status: input.status,
      priority: input.priority ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: actor?.sub ?? null,
      updatedBy: actor?.sub ?? null,
    });

    const saved = await this.targetsRepo.save(entity);

    if (actor) {
      await this.auditLog.log({
        actorId: actor.sub,
        actorCallsign: actor.callsign,
        actorRole: actor.role,
        action: 'target_created',
        severity: 'info',
        target: `target:${saved.id}`,
        description: `Створено ціль "${saved.title}" (${saved.id})`,
      });
    }

    return mapTargetToDto(saved);
  }

  async update(
    id: string,
    input: UpdateTargetInput,
    actor?: JwtPayload,
  ): Promise<TargetDto> {
    const target = await this.targetsRepo.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Target not found');
    }

    if (input.title !== undefined) target.title = input.title;
    if (input.description !== undefined)
      target.description = input.description ?? null;
    if (input.type !== undefined) target.type = input.type ?? null;
    if (input.status !== undefined) target.status = input.status;
    if (input.priority !== undefined) target.priority = input.priority ?? null;
    if (input.latitude !== undefined) target.latitude = input.latitude ?? null;
    if (input.longitude !== undefined)
      target.longitude = input.longitude ?? null;

    target.lastSeenAt = new Date();
    target.updatedAt = new Date();
    if (actor) target.updatedBy = actor.sub;

    const saved = await this.targetsRepo.save(target);

    if (actor) {
      await this.auditLog.log({
        actorId: actor.sub,
        actorCallsign: actor.callsign,
        actorRole: actor.role,
        action: 'target_updated',
        severity: 'info',
        target: `target:${saved.id}`,
        description: `Оновлено ціль "${saved.title}" (${saved.id})`,
      });
    }

    return mapTargetToDto(saved);
  }

  async delete(id: string, actor?: JwtPayload): Promise<void> {
    const target = await this.targetsRepo.findOne({ where: { id } });
    if (!target) {
      throw new NotFoundException('Target not found');
    }

    if (target.archived) {
      throw new BadRequestException('Target is already archived');
    }

    target.archived = true;
    target.updatedAt = new Date();
    if (actor) {
      target.updatedBy = actor.sub;
    }

    await this.targetsRepo.save(target);

    if (actor) {
      await this.auditLog.log({
        actorId: actor.sub,
        actorCallsign: actor.callsign,
        actorRole: actor.role,
        action: 'target_archived',
        severity: 'warning',
        target: `target:${id}`,
        description: `Архівовано ціль "${target.title}" (${id})`,
      });
    }
  }
}
