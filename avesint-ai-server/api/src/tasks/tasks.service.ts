// src/tasks/tasks.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './task.entity';
import type {
  TaskDto,
  TaskPriority,
  TaskRole,
  TaskStatus,
} from './dto/task.dto';
import { mapTaskToDto } from './dto/task.dto';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Role } from '../users/role.enum';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UsersService } from '../users/users.service';

export interface ListTasksParams {
  page?: number;
  pageSize?: number;
  status?: TaskStatus[];
  priority?: TaskPriority[];
  role?: TaskRole[];
  assigneeCallsign?: string;
  onlyMine?: boolean;
  parentTaskId?: string;
  archived?: boolean;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  role?: TaskRole;
  assigneeId?: string;
  assigneeCallsign?: string;
  assigneeRank?: string;
  assigneeUnit?: string;
  targetId?: string;
  eventId?: string;
  dueAt?: string;
  parentTaskId?: string;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasksRepo: Repository<Task>,
    private readonly auditLog: AuditLogService,
    private readonly usersService: UsersService,
  ) {}

  async list(
    params: ListTasksParams,
    actor: JwtPayload,
  ): Promise<{
    items: TaskDto[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 10, 1), 100);

    const qb = this.tasksRepo.createQueryBuilder('t');

    if (params.archived === true) {
      qb.andWhere('t.archived = true');
    } else {
      qb.andWhere('t.archived = false');
    }

    if (params.status && params.status.length > 0) {
      qb.andWhere('t.status IN (:...status)', { status: params.status });
    }

    if (params.priority && params.priority.length > 0) {
      qb.andWhere('t.priority IN (:...priority)', {
        priority: params.priority,
      });
    }

    if (params.role && params.role.length > 0) {
      qb.andWhere('t.role IN (:...roles)', { roles: params.role });
    }

    if (params.assigneeCallsign && params.assigneeCallsign.trim().length > 0) {
      qb.andWhere('LOWER(t.assigneeCallsign) = :cs', {
        cs: params.assigneeCallsign.trim().toLowerCase(),
      });
    }

    if (params.onlyMine) {
      const cs = actor.callsign.toLowerCase();
      qb.andWhere('LOWER(t.assigneeCallsign) = :mineCs', { mineCs: cs });
    }

    if (params.parentTaskId) {
      qb.andWhere('t.parentTaskId = :parentTaskId', {
        parentTaskId: params.parentTaskId,
      });
    }

    const [tasks, total] = await qb
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: tasks.map(mapTaskToDto),
      page,
      pageSize,
      total,
    };
  }

  async getById(id: string): Promise<TaskDto> {
    const task = await this.tasksRepo.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return mapTaskToDto(task);
  }

  async create(input: CreateTaskInput, actor: JwtPayload): Promise<TaskDto> {
    const now = new Date();
    const dueAt = input.dueAt ? new Date(input.dueAt) : null;

    const isTopLevel = !input.parentTaskId;
    const actorRole = actor.role;
    const isAdminOrOfficer =
      actorRole === Role.ADMIN || actorRole === Role.OFFICER;

    let parentTask: Task | null = null;

    if (isTopLevel) {
      if (!isAdminOrOfficer) {
        throw new ForbiddenException(
          'Тільки адміністратор або офіцер можуть створювати основні задачі',
        );
      }
    } else {
      parentTask = await this.tasksRepo.findOne({
        where: { id: input.parentTaskId },
      });
      if (!parentTask) {
        throw new NotFoundException('Батьківська задача не знайдена');
      }
      if (parentTask.parentTaskId) {
        throw new BadRequestException(
          'Не можна створювати підзадачу для підзадачі',
        );
      }

      if (!isAdminOrOfficer) {
        if (!parentTask.assigneeId || parentTask.assigneeId !== actor.sub) {
          throw new ForbiddenException(
            'Можна створювати підзадачі лише для власних задач',
          );
        }
      }
    }

    let assigneeId = input.assigneeId ?? null;
    let assigneeCallsign = input.assigneeCallsign ?? null;
    const assigneeRank = input.assigneeRank ?? null;
    const assigneeUnit = input.assigneeUnit ?? null;

    if (isTopLevel) {
      if (assigneeCallsign && assigneeCallsign.trim().length > 0) {
        const user = await this.usersService.findByCallsign(
          assigneeCallsign.trim(),
        );
        if (!user) {
          throw new BadRequestException(
            'Користувача з таким позивним не знайдено',
          );
        }
        assigneeId = user.id;
        assigneeCallsign = user.callsign;
      }
    } else {
      if (!isAdminOrOfficer) {
        assigneeId = actor.sub;
        assigneeCallsign = actor.callsign;
      } else {
        if (assigneeCallsign && assigneeCallsign.trim().length > 0) {
          const user = await this.usersService.findByCallsign(
            assigneeCallsign.trim(),
          );
          if (!user) {
            throw new BadRequestException(
              'Користувача з таким позивним не знайдено',
            );
          }
          assigneeId = user.id;
          assigneeCallsign = user.callsign;
        }
      }
    }

    const targetId =
      !isTopLevel && parentTask
        ? (input.targetId ?? parentTask.targetId)
        : (input.targetId ?? null);
    const eventId =
      !isTopLevel && parentTask
        ? (input.eventId ?? parentTask.eventId)
        : (input.eventId ?? null);
    const role =
      !isTopLevel && parentTask
        ? (input.role ?? (parentTask.role as TaskRole | null))
        : (input.role ?? null);

    const entity = this.tasksRepo.create({
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'new',
      priority: input.priority ?? 'medium',
      role,
      assigneeId,
      assigneeCallsign,
      assigneeRank,
      assigneeUnit,
      targetId,
      eventId,
      dueAt,
      parentTaskId: isTopLevel ? null : input.parentTaskId!,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.sub,
      updatedBy: actor.sub,
    });

    const saved = await this.tasksRepo.save(entity);

    await this.auditLog.log({
      actorId: actor.sub,
      actorCallsign: actor.callsign,
      actorRole: actor.role,
      action: isTopLevel ? 'task_created' : 'task_subtask_created',
      severity: 'info',
      target: `task:${saved.id}`,
      description: isTopLevel
        ? `Створено задачу "${saved.title}" (${saved.id})`
        : `Створено підзадачу "${saved.title}" (${saved.id}) для задачі ${input.parentTaskId}`,
    });

    return mapTaskToDto(saved);
  }

  async update(
    id: string,
    input: UpdateTaskInput,
    actor: JwtPayload,
  ): Promise<TaskDto> {
    const task = await this.tasksRepo.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const actorRole = actor.role;
    const isAdminOrOfficer =
      actorRole === Role.ADMIN || actorRole === Role.OFFICER;
    const isSubtask = !!task.parentTaskId;
    const isOwner = task.assigneeId === actor.sub;

    // Перевірка прав:
    if (!isSubtask) {
      // Основні задачі: адміністратор/офіцер АБО виконавець задачі
      if (!isAdminOrOfficer && !isOwner) {
        throw new ForbiddenException(
          'Редагувати основні задачі можуть тільки адміністратор, офіцер або виконавець задачі',
        );
      }
    } else {
      // Підзадачі: як було раніше
      if (!isAdminOrOfficer) {
        if (!task.assigneeId || task.assigneeId !== actor.sub) {
          throw new ForbiddenException(
            'Редагувати підзадачу може тільки її виконавець',
          );
        }
      }
    }

    const oldSnapshot = {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      role: task.role,
      assigneeId: task.assigneeId,
      assigneeCallsign: task.assigneeCallsign,
      assigneeRank: task.assigneeRank,
      assigneeUnit: task.assigneeUnit,
      targetId: task.targetId,
      eventId: task.eventId,
      dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    };

    // Далі – як у тебе було: оновлення полів, diff і логування
    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined)
      task.description = input.description ?? null;
    if (input.status !== undefined) task.status = input.status;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.role !== undefined) task.role = input.role ?? null;

    if (isAdminOrOfficer) {
      if (input.assigneeId !== undefined)
        task.assigneeId = input.assigneeId ?? null;
      if (input.assigneeCallsign !== undefined) {
        task.assigneeCallsign = input.assigneeCallsign ?? null;
      }
      if (input.assigneeRank !== undefined)
        task.assigneeRank = input.assigneeRank ?? null;
      if (input.assigneeUnit !== undefined)
        task.assigneeUnit = input.assigneeUnit ?? null;
    }

    if (input.targetId !== undefined) task.targetId = input.targetId ?? null;
    if (input.eventId !== undefined) task.eventId = input.eventId ?? null;
    if (input.dueAt !== undefined) {
      task.dueAt = input.dueAt ? new Date(input.dueAt) : null;
    }

    task.updatedAt = new Date();
    task.updatedBy = actor.sub;

    const saved = await this.tasksRepo.save(task);

    const newSnapshot = {
      title: saved.title,
      description: saved.description,
      status: saved.status,
      priority: saved.priority,
      role: saved.role,
      assigneeId: saved.assigneeId,
      assigneeCallsign: saved.assigneeCallsign,
      assigneeRank: saved.assigneeRank,
      assigneeUnit: saved.assigneeUnit,
      targetId: saved.targetId,
      eventId: saved.eventId,
      dueAt: saved.dueAt ? saved.dueAt.toISOString() : null,
    };

    const changes: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(oldSnapshot) as Array<
      keyof typeof oldSnapshot
    >) {
      if (oldSnapshot[key] !== newSnapshot[key]) {
        changes[key] = {
          old: oldSnapshot[key],
          new: newSnapshot[key],
        };
      }
    }

    await this.auditLog.log({
      actorId: actor.sub,
      actorCallsign: actor.callsign,
      actorRole: actor.role,
      action: 'task_updated',
      severity: 'info',
      target: `task:${saved.id}`,
      description: `Оновлено задачу "${saved.title}" (${saved.id})`,
      context: Object.keys(changes).length > 0 ? { changes } : undefined,
    });

    return mapTaskToDto(saved);
  }

  async delete(id: string, actor: JwtPayload): Promise<void> {
    const task = await this.tasksRepo.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    if (task.archived) {
      throw new BadRequestException('Task is already archived');
    }

    const actorRole = actor.role;
    const isAdminOrOfficer =
      actorRole === Role.ADMIN || actorRole === Role.OFFICER;
    const isSubtask = !!task.parentTaskId;

    if (!isSubtask) {
      if (!isAdminOrOfficer) {
        throw new ForbiddenException(
          'Архівувати основні задачі можуть тільки адміністратор або офіцер',
        );
      }
    } else {
      if (!isAdminOrOfficer) {
        if (!task.assigneeId || task.assigneeId !== actor.sub) {
          throw new ForbiddenException(
            'Архівувати підзадачу може тільки її виконавець',
          );
        }
      }
    }

    task.archived = true;
    task.updatedAt = new Date();
    task.updatedBy = actor.sub;

    await this.tasksRepo.save(task);

    await this.auditLog.log({
      actorId: actor.sub,
      actorCallsign: actor.callsign,
      actorRole: actor.role,
      action: 'task_archived',
      severity: 'warning',
      target: `task:${id}`,
      description: `Архівовано задачу "${task.title}" (${id})`,
    });
  }
}
