// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TwoFactorModule } from './two-factor/two-factor.module';
import { EventsModule } from './events/events.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { TargetsModule } from './targets/targets.module';
import { TasksModule } from './tasks/tasks.module';
import { AiStreamGateway } from './ai-stream/ai-stream.gateway';
import { OsintModule } from './osint/osint.module';
import { StreamModule } from './stream/stream.module';
import { ReportsModule } from './reports/reports.module';
import { QdrantService } from './common/qdrant.service';
import { AiSearchController } from './ai-stream/ai-search.controller';
import { AiMapController } from './ai-stream/ai-map.controller';
import { AiQueryModule } from './ai/ai-query.module'
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT')),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        // Головне: піднімаємо всі entity, які підʼєднані через forFeature
        autoLoadEntities: true,
        synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
      }),
    }),
    UsersModule,
    AuthModule,
    TwoFactorModule,
    EventsModule,
    AuditLogModule,
    TargetsModule,
    TasksModule,
    OsintModule,
    StreamModule,
    ReportsModule,
    AiQueryModule,
  ],
  providers: [AiStreamGateway, QdrantService],
  controllers: [AiSearchController, AiMapController],
})
export class AppModule {}
