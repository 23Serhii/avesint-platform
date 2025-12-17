// api/src/osint/osint.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OsintController } from './osint.controller';
import { OsintService } from './osint.service';
import { OsintGateway } from './osint.gateway';
import { OsintSourceEntity } from './osint-source.entity';
import { OsintItemEntity } from './osint-item.entity';
import { EventsModule } from '../events/events.module';
import { QdrantService } from '../common/qdrant.service';
import { AiGeoService } from '../common/ai-geo.service';
import { AiClassificationService } from '../common/ai-classification.service';
import { OsintSourcesController } from './osint-sources.controller';
import { OsintItemsController } from './osint-items.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([OsintSourceEntity, OsintItemEntity]),
    EventsModule,
  ],
  controllers: [OsintController, OsintSourcesController, OsintItemsController],
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
