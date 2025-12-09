// src/events/events.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  NotFoundException,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { EventsService } from './events.service';
import {
  listEventsQuerySchema,
  createEventSchema,
  updateEventSchema,
} from './events.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/role.enum';
import { GetUser } from '../common/decorators/get-user.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async list(@Query() query: Record<string, any>) {
    const parsed = listEventsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid query parameters',
        errors: parsed.error.flatten(),
      });
    }

    return this.eventsService.listEvents(parsed.data);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const event = await this.eventsService.getEventById(id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  @Roles(Role.ADMIN, Role.OFFICER, Role.ANALYST)
  @Post()
  async create(
    @Body() body: unknown,
    @GetUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid payload',
        errors: parsed.error.flatten(),
      });
    }

    const ip =
      (req.ip || (req.headers['x-forwarded-for'] as string | undefined)) ??
      null;

    return this.eventsService.createEvent(parsed.data, user, ip);
  }

  @Roles(Role.ADMIN, Role.OFFICER, Role.ANALYST)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: unknown,
    @GetUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid payload',
        errors: parsed.error.flatten(),
      });
    }

    const ip =
      (req.ip || (req.headers['x-forwarded-for'] as string | undefined)) ??
      null;

    const updated = await this.eventsService.updateEvent(
      id,
      parsed.data,
      user,
      ip,
    );
    if (!updated) {
      throw new NotFoundException('Event not found');
    }

    return updated;
  }

  @Roles(Role.ADMIN, Role.OFFICER, Role.ANALYST)
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @GetUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const ip =
      (req.ip || (req.headers['x-forwarded-for'] as string | undefined)) ??
      null;

    const ok = await this.eventsService.deleteEvent(id, user, ip);
    if (!ok) {
      throw new NotFoundException('Event not found');
    }
    return { success: true };
  }
}
