// src/audit-log/audit-log.controller.ts
import {
  Controller,
  Get,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { AuditLogService, type AuditSeverity } from './audit-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // журнал дій бачить тільки адмін (можеш розширити)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async list(@Query() query: Record<string, any>) {
    const page = query.page ? Number(query.page) : 1;
    const pageSize = query.pageSize ? Number(query.pageSize) : 20;
    if (Number.isNaN(page) || Number.isNaN(pageSize)) {
      throw new BadRequestException('Invalid page or pageSize');
    }

    const severity: AuditSeverity[] | undefined = query.severity
      ? Array.isArray(query.severity)
        ? query.severity
        : [query.severity]
      : undefined;

    const action: string[] | undefined = query.action
      ? Array.isArray(query.action)
        ? query.action
        : [query.action]
      : undefined;

    const search: string | undefined = query.search;

    return this.auditLogService.list({
      page,
      pageSize,
      severity,
      action,
      search,
    });
  }
}
