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
} from '@nestjs/common';
import { EventsService } from './events.service';
import {
  listEventsQuerySchema,
  createEventSchema,
  updateEventSchema,
} from './events.schema';

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

  @Post()
  async create(@Body() body: unknown) {
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid payload',
        errors: parsed.error.flatten(),
      });
    }

    return this.eventsService.createEvent(parsed.data);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid payload',
        errors: parsed.error.flatten(),
      });
    }

    const updated = await this.eventsService.updateEvent(id, parsed.data);
    if (!updated) {
      throw new NotFoundException('Event not found');
    }

    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const ok = await this.eventsService.deleteEvent(id);
    if (!ok) {
      throw new NotFoundException('Event not found');
    }
    return { success: true };
  }
}
