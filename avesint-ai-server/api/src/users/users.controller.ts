// src/users/users.controller.ts
import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Role } from './role.enum';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { UserStatus } from './dto/user.dto';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('status') status?: string | string[],
    @Query('role') roles?: string | string[],
    @Query('username') username?: string,
  ) {
    const toArray = (v?: string | string[]): string[] | undefined => {
      if (!v) return undefined;
      return Array.isArray(v) ? v : [v];
    };

    const statusArr = toArray(status) as UserStatus[] | undefined;
    const rolesArr = toArray(roles) as Role[] | undefined;

    return this.usersService.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 10,
      status: statusArr,
      roles: rolesArr,
      username,
    });
  }

  @Patch(':id/role')
  async setRole(
    @Param('id') id: string,
    @Body('role') role: Role,
    @GetUser() actor: JwtPayload,
  ) {
    return this.usersService.setRole(id, role, actor.callsign);
  }
}
