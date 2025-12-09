// api/src/osint/osint.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { OsintService } from './osint.service';
import { OsintIngestDto } from './dto/osint-ingest.dto';

@Controller('osint')
export class OsintController {
  constructor(private readonly osint: OsintService) {}

  @Post('ingest')
  async ingest(@Body() dto: any) {
    // Для дебагу можна подивитись, що реально прилетіло

    console.log('OSINT ingest DTO:', JSON.stringify(dto, null, 2));

    return this.osint.ingest(dto);
  }
}
