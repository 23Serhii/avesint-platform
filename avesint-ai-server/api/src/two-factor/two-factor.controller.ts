import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import express from 'express';
import { TwoFactorService } from './two-factor.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { Verify2FADto } from './dto/verify-2fa.dto';
import { AuditLogService } from '../audit-log/audit-log.service';

@UseGuards(JwtAuthGuard)
@Controller('2fa')
export class TwoFactorController {
  constructor(
    private twoFactorService: TwoFactorService,
    private usersService: UsersService,
    private authService: AuthService,
    private auditLog: AuditLogService,
  ) {}

  @Post('generate')
  async generate(@Req() req: express.Request) {
    const user = req.user as JwtPayload;
    const result = await this.twoFactorService.generateSecret(user.sub);

    await this.auditLog.log({
      actorId: user.sub,
      actorCallsign: user.callsign,
      actorRole: user.role,
      actorDisplayName: null,
      actorIsTwoFactorEnabled: user.isTwoFactorEnabled,
      action: '2fa_generate',
      severity: 'info',
      target: `user:${user.sub}`,
      description: `Користувач "${user.callsign}" ініціював налаштування 2FA`,
    });

    return result;
  }

  @Post('turn-on')
  async turnOn(@Req() req: express.Request, @Body() dto: Verify2FADto) {
    const user = req.user as JwtPayload;
    const dbUser = await this.usersService.findById(user.sub);
    if (!dbUser?.twoFactorSecret) {
      await this.auditLog.log({
        actorId: user.sub,
        actorCallsign: user.callsign,
        actorRole: user.role,
        actorDisplayName: dbUser?.displayName ?? null,
        actorIsTwoFactorEnabled: dbUser?.isTwoFactorEnabled ?? null,
        action: '2fa_enable_failed',
        severity: 'warning',
        target: `user:${user.sub}`,
        description: 'Спроба увімкнути 2FA без ініціалізованого секрету',
      });
      throw new UnauthorizedException('2FA not initialized');
    }

    const isValid = this.twoFactorService.isCodeValid(
      dto.code,
      dbUser.twoFactorSecret,
    );
    if (!isValid) {
      await this.auditLog.log({
        actorId: user.sub,
        actorCallsign: user.callsign,
        actorRole: user.role,
        actorDisplayName: dbUser.displayName ?? null,
        actorIsTwoFactorEnabled: dbUser.isTwoFactorEnabled ?? null,
        action: '2fa_enable_failed',
        severity: 'warning',
        target: `user:${user.sub}`,
        description: 'Невірний код при спробі увімкнути 2FA',
      });
      throw new UnauthorizedException('Invalid code');
    }

    await this.twoFactorService.enable(user.sub);

    await this.auditLog.log({
      actorId: user.sub,
      actorCallsign: user.callsign,
      actorRole: user.role,
      actorDisplayName: dbUser.displayName ?? null,
      actorIsTwoFactorEnabled: true,
      action: '2fa_enable_success',
      severity: 'info',
      target: `user:${user.sub}`,
      description: `Користувач "${user.callsign}" успішно увімкнув 2FA`,
    });

    return { message: '2FA enabled' };
  }

  // верифікація після логіна з tempAccessToken
  @Post('verify')
  async verify(@Req() req: express.Request, @Body() dto: Verify2FADto) {
    const user = req.user as JwtPayload;
    const dbUser = await this.usersService.findById(user.sub);
    if (!dbUser?.twoFactorSecret) {
      await this.auditLog.log({
        actorId: user.sub,
        actorCallsign: user.callsign,
        actorRole: user.role,
        actorDisplayName: dbUser?.displayName ?? null,
        actorIsTwoFactorEnabled: dbUser?.isTwoFactorEnabled ?? null,
        action: '2fa_verify_failed',
        severity: 'warning',
        target: `user:${user.sub}`,
        description: 'Спроба верифікації 2FA без ініціалізованого секрету',
      });
      throw new UnauthorizedException('2FA not initialized');
    }

    const isValid = this.twoFactorService.isCodeValid(
      dto.code,
      dbUser.twoFactorSecret,
    );
    if (!isValid) {
      await this.auditLog.log({
        actorId: user.sub,
        actorCallsign: user.callsign,
        actorRole: user.role,
        actorDisplayName: dbUser.displayName ?? null,
        actorIsTwoFactorEnabled: dbUser.isTwoFactorEnabled ?? null,
        action: '2fa_verify_failed',
        severity: 'warning',
        target: `user:${user.sub}`,
        description: 'Невдала перевірка 2FA (невірний код)',
      });
      throw new UnauthorizedException('Invalid code');
    }

    const tokens = this.authService.issueTokens({
      sub: dbUser.id,
      callsign: dbUser.callsign,
      role: dbUser.role,
      isTwoFactorEnabled: true,
      isSecondFactorAuthenticated: true,
    });

    await this.auditLog.log({
      actorId: dbUser.id,
      actorCallsign: dbUser.callsign,
      actorRole: dbUser.role,
      actorDisplayName: dbUser.displayName ?? null,
      actorIsTwoFactorEnabled: true,
      action: '2fa_verify_success',
      severity: 'info',
      target: `user:${dbUser.id}`,
      description: `Користувач "${dbUser.callsign}" успішно пройшов 2FA`,
    });

    return { user: dbUser, requires2FA: false, ...tokens };
  }
}
