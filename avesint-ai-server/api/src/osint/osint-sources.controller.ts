import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Query,
  Post,
  BadRequestException,
  Delete,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { OsintSourceEntity } from './osint-source.entity';

@Controller('osint/sources')
export class OsintSourcesController {
  constructor(
    @InjectRepository(OsintSourceEntity)
    private readonly sourceRepo: Repository<OsintSourceEntity>,
  ) {}

  @Get()
  async list(
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
    @Query('category') category?: string,
  ) {
    const where: FindOptionsWhere<OsintSourceEntity> = {};

    if (type) {
      where.type = type;
    }

    if (typeof category === 'string') {
      where.category = category;
    }

    if (typeof isActive === 'string') {
      if (isActive === 'true') where.isActive = true;
      else if (isActive === 'false') where.isActive = false;
    }

    const items = await this.sourceRepo.find({
      where,
      order: { name: 'ASC' },
    });
    return items;
  }

  @Post()
  async create(
    @Body()
    body: {
      url: string;
      category?: string | null;
      isActive?: boolean;
    },
  ) {
    const rawUrl = (body.url ?? '').trim();
    if (!rawUrl) {
      throw new BadRequestException('url is required');
    }

    // Підтримуємо формати:
    // - https://t.me/rybar
    // - http://t.me/rybar
    // - t.me/rybar
    // - @rybar
    let handle = rawUrl;

    handle = handle.replace(/^https?:\/\//i, '');
    handle = handle.replace(/^(?:t\.me|telegram\.me)\//i, '');
    handle = handle.replace(/^@/, '');
    handle = handle.split(/[/?#]/)[0].trim();

    if (!handle) {
      throw new BadRequestException('Cannot extract Telegram handle from url');
    }

    const externalId = `telegram:${handle}`;

    const existing = await this.sourceRepo.findOne({
      where: { externalId },
    });
    if (existing) {
      existing.url = existing.url ?? `https://t.me/${handle}`;
      if (body.category !== undefined) {
        existing.category = body.category;
      }
      if (typeof body.isActive === 'boolean') {
        existing.isActive = body.isActive;
      }
      return this.sourceRepo.save(existing);
    }

    const entity = this.sourceRepo.create({
      externalId,
      type: 'telegram', // узгоджено з уже наявними записами
      name: handle,
      handle,
      url: `https://t.me/${handle}`,
      category: body.category ?? null,
      isActive: body.isActive ?? true,
      reliability: 0.5,
      totalItems: 0,
      confirmedItems: 0,
      disprovedItems: 0,
      meta: {},
    });

    return this.sourceRepo.save(entity);
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body()
    body: {
      isActive?: boolean;
      tags?: string[];
      category?: string | null;
      meta?: Record<string, unknown>;
    },
  ) {
    const src = await this.sourceRepo.findOne({ where: { id } });
    if (!src) return null;

    if (typeof body.isActive === 'boolean') {
      src.isActive = body.isActive;
    }
    if (Array.isArray(body.tags)) {
      src.tags = body.tags;
    }
    if (body.category !== undefined) {
      src.category = body.category;
    }
    if (body.meta && typeof body.meta === 'object') {
      src.meta = {
        ...(src.meta ?? {}),
        ...body.meta,
      };
    }

    return this.sourceRepo.save(src);
  }

  @Delete(':id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    const existing = await this.sourceRepo.findOne({ where: { id } });
    if (!existing) {
      return { success: false, reason: 'not_found' };
    }
    await this.sourceRepo.remove(existing);
    return { success: true };
  }
}
