// src/ai/ai-query.controller.ts
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common'
import { AiQueryService } from './ai-query.service'
import type { AiQueryRequest, AiQueryResponse } from './ai-query.types'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiQueryController {
  constructor(private readonly aiQueryService: AiQueryService) {}

  @Post('query')
  async query(
    @Body() body: AiQueryRequest,
    @Req() req: any,
  ): Promise<AiQueryResponse> {
    const userId: string | undefined = req.user?.sub
    return this.aiQueryService.handleQuery(body, userId)
  }
}