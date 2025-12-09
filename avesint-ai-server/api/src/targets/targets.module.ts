// src/targets/targets.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Target } from './target.entity';
import { TargetsService } from './targets.service';
import { TargetsController } from './targets.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Target]), AuditLogModule],
  providers: [TargetsService],
  controllers: [TargetsController],
})
export class TargetsModule {}
