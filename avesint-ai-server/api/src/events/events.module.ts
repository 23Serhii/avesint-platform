// src/events/events.module.ts
import { Module } from '@nestjs/common'
import { EventsService } from './events.service'
import { EventsController } from './events.controller'
import { AuditLogModule } from '../audit-log/audit-log.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { OsintItemEntity } from '../osint/osint-item.entity'
import { OsintSourceEntity } from '../osint/osint-source.entity'
import { QdrantService } from '../common/qdrant.service' // 🔹 новий імпорт

@Module({
  imports: [
    AuditLogModule,
    TypeOrmModule.forFeature([OsintItemEntity, OsintSourceEntity]),
  ],
  controllers: [EventsController],
  providers: [EventsService, QdrantService], // 🔹 додаємо QdrantService
  exports: [EventsService],
})
export class EventsModule {}