// avesint-ai-server/api/src/targets/targets.controller.ts
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
import { TargetsService } from './targets.service';
import type { TargetPriority, TargetStatus } from './dto/target.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/role.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('targets')
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('type') type?: string | string[],
    @Query('search') search?: string,
    @Query('archived') archived?: string,
  ) {
    const statusArr = this.toArray(status) as TargetStatus[] | undefined;
    const priorityArr = this.toArray(priority) as TargetPriority[] | undefined;
    const typeArr = this.toArray(type);
    const archivedBool = this.parseBoolQuery(archived);

    return this.targetsService.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
      status: statusArr,
      priority: priorityArr,
      type: typeArr,
      search: search ?? undefined,
      archived: archivedBool,
    });
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.targetsService.getById(id);
  }

  @Roles(Role.ADMIN, Role.OFFICER)
  @Post()
  async create(
    @Body()
    body: {
      title: string;
      description?: string;
      type?: string;
      status: TargetStatus;
      priority?: TargetPriority;
      latitude?: number;
      longitude?: number;
    },
    @GetUser() user: JwtPayload,
  ) {
    return this.targetsService.create(body, user);
  }

  @Roles(Role.ADMIN, Role.OFFICER)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: Partial<{
      title: string;
      description: string;
      type: string;
      status: TargetStatus;
      priority: TargetPriority;
      latitude: number;
      longitude: number;
    }>,
    @GetUser() user: JwtPayload,
  ) {
    return this.targetsService.update(id, body, user);
  }

  @Roles(Role.ADMIN, Role.OFFICER)
  @Delete(':id')
  async delete(@Param('id') id: string, @GetUser() user: JwtPayload) {
    await this.targetsService.delete(id, user);
    return { success: true };
  }
}
