// src/tasks/tasks.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/role.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import type { TaskPriority, TaskRole, TaskStatus } from './dto/task.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  private toArray(v?: string | string[]): string[] | undefined {
    if (!v) return undefined;
    return Array.isArray(v) ? v : [v];
  }

  private parseBoolQuery(v?: string): boolean | undefined {
    if (v === 'true') return true;
    if (v === 'false') return false;
    return undefined;
  }

  @Get()
  async list(
    @GetUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('role') role?: string | string[],
    @Query('assignee') assignee?: string,
    @Query('archived') archived?: string,
  ) {
    const statusArr = this.toArray(status) as TaskStatus[] | undefined;
    const priorityArr = this.toArray(priority) as TaskPriority[] | undefined;
    const roleArr = this.toArray(role) as TaskRole[] | undefined;

    const userRole = user.role;
    const canViewAll = [Role.ADMIN, Role.OFFICER].includes(userRole);
    const archivedBool = this.parseBoolQuery(archived);

    return this.tasksService.list(
      {
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 10,
        status: statusArr,
        priority: priorityArr,
        role: roleArr,
        assigneeCallsign: assignee,
        onlyMine: !canViewAll,
        archived: archivedBool,
      },
      user,
    );
  }

  @Get(':id/subtasks')
  async listSubtasks(
    @GetUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('role') role?: string | string[],
  ) {
    const statusArr = this.toArray(status) as TaskStatus[] | undefined;
    const priorityArr = this.toArray(priority) as TaskPriority[] | undefined;
    const roleArr = this.toArray(role) as TaskRole[] | undefined;

    const userRole = user.role;
    const canViewAll = [Role.ADMIN, Role.OFFICER].includes(userRole);

    return this.tasksService.list(
      {
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 10,
        status: statusArr,
        priority: priorityArr,
        role: roleArr,
        parentTaskId: id,
        onlyMine: !canViewAll,
        archived: false,
      },
      user,
    );
  }

  @Roles(Role.ADMIN, Role.OFFICER)
  @Post()
  async create(
    @Body()
    body: {
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
    },
    @GetUser() user: JwtPayload,
  ) {
    return this.tasksService.create(body, user);
  }

  @Post(':id/subtasks')
  async createSubtask(
    @Param('id') id: string,
    @Body()
    body: {
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
    },
    @GetUser() user: JwtPayload,
  ) {
    return this.tasksService.create(
      {
        ...body,
        parentTaskId: id,
      },
      user,
    );
  }

  // Оновлення задачі: дозволене для всіх аутентифікованих, ролі перевіряємо в сервісі
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      description: string;
      status: TaskStatus;
      priority: TaskPriority;
      role: TaskRole;
      assigneeId: string;
      assigneeCallsign: string;
      assigneeRank: string;
      assigneeUnit: string;
      targetId: string;
      eventId: string;
      dueAt: string;
    }>,
    @GetUser() user: JwtPayload,
  ) {
    return this.tasksService.update(id, body, user);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @GetUser() user: JwtPayload) {
    await this.tasksService.delete(id, user);
    return { success: true };
  }
}
