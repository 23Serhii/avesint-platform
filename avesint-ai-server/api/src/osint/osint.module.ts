// api/src/osint/osint.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OsintController } from './osint.controller';
import { OsintService } from './osint.service';
import { OsintGateway } from './osint.gateway';
import { OsintSourceEntity } from './osint-source.entity';
import { OsintItemEntity } from './osint-item.entity';
import { EventsModule } from '../events/events.module'; // <-- додаємо
import { QdrantService } from '../common/qdrant.service';
import { AiGeoService } from '../common/ai-geo.service'; // <-- додали
import { AiClassificationService } from '../common/ai-classification.service'; // <-- новий
import { OsintSourcesController } from './osint-sources.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OsintSourceEntity, OsintItemEntity]),
    EventsModule, // <-- тут
  ],
  controllers: [OsintController, OsintSourcesController],
  providers: [
    OsintService,
    OsintGateway,
    QdrantService,
    AiGeoService,
    AiClassificationService,
  ],
  exports: [OsintService],
})
export class OsintModule {}
