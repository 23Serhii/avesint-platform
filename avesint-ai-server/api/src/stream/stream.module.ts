// api/src/stream/stream.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StreamController } from './stream.controller';
import { StreamService } from './stream.service';
import { EventsModule } from '../events/events.module';
import { OsintItemEntity } from '../osint/osint-item.entity';
import { QdrantService } from '../common/qdrant.service';

@Module({
  imports: [EventsModule, TypeOrmModule.forFeature([OsintItemEntity])],
  controllers: [StreamController],
  providers: [StreamService, QdrantService],
  exports: [StreamService],
})
export class StreamModule {}
