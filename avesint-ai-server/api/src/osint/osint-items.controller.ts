// api/src/osint/osint-items.controller.ts
import {
  Body,
  Controller,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { OsintService } from './osint.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../users/role.enum';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('osint/items')
export class OsintItemsController {
  constructor(private readonly osint: OsintService) {}

  @Roles(Role.ADMIN, Role.OFFICER, Role.ANALYST)
  @Post(':id/review')
  async review(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { verdict?: string },
  ) {
    const verdict = String(body?.verdict ?? '').trim();
    if (!['confirmed', 'disproved', 'unknown'].includes(verdict)) {
      throw new BadRequestException(
        'verdict must be confirmed|disproved|unknown',
      );
    }

    const res = await this.osint.reviewOsintItem(id, verdict as any);
    if (!res) {
      throw new NotFoundException('OSINT item not found');
    }
    return res;
  }
}
