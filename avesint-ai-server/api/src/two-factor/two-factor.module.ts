import { Module } from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorController } from './two-factor.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../audit-log/audit-log.module'; // <-- додаємо

@Module({
  imports: [UsersModule, AuthModule, AuditLogModule],
  providers: [TwoFactorService],
  controllers: [TwoFactorController],
})
export class TwoFactorModule {}
