// src/ai/ai-query.module.ts
import { Module } from '@nestjs/common'
import { AiQueryController } from './ai-query.controller'
import { AiQueryService } from './ai-query.service'
import { EventsModule } from '../events/events.module'
import { AiQdrantSearchService } from './ai-qdrant-search.service'
import { AiQdrantSearchController } from './ai-qdrant-search.controller'
import { AiQueryLogService } from './ai-query-log.service'

@Module({
  imports: [EventsModule],
  controllers: [AiQueryController, AiQdrantSearchController],
  providers: [AiQueryService, AiQdrantSearchService, AiQueryLogService],
  exports: [AiQueryService],
})
export class AiQueryModule {}