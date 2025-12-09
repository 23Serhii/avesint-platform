// api/src/stream/stream.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { StreamService } from './stream.service';
import {
  StreamQueryDto,
  ReviewStreamItemDto,
} from './dto/intelligence-item.dto';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('stream')
export class StreamController {
  constructor(private readonly stream: StreamService) {}

  @Get()
  async list(@Query() query: StreamQueryDto) {
    return this.stream.list(query);
  }

  @Patch(':id/review')
  async reviewItem(
    @Param('id') id: string,
    @Body() body: ReviewStreamItemDto,
    @Req() req: Request,
  ) {
    const actor = (req.user ?? null) as JwtPayload | null;
    const ip = (req.headers['x-forwarded-for'] as string | undefined) ?? req.ip;

    const updated = await this.stream.reviewItem(
      id,
      body,
      actor ?? undefined,
      ip,
    );
    return updated;
  }
}
