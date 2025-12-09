// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import { AuditLogService } from '../audit-log/audit-log.service'; // <-- додали імпорт

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
    private auditLog: AuditLogService, // <-- інжектимо сервіс
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.usersService.create(dto);

    const tokens = this.issueTokens({
      sub: user.id,
      callsign: user.callsign,
      role: user.role,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
    });

    // Логуємо реєстрацію (actor = новий користувач)
    await this.auditLog.log({
      actorId: user.id,
      actorCallsign: user.callsign,
      actorRole: user.role,
      actorDisplayName: user.displayName ?? null,
      actorIsTwoFactorEnabled: user.isTwoFactorEnabled ?? null,
      action: 'user_created',
      severity: 'info',
      target: `user:${user.id}`,
      description: `Створено користувача з позивним "${user.callsign}"`,
      // ip, userAgent, context можна додати пізніше, якщо матимеш Request
    });

    return { user, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByCallsign(dto.callsign);
    if (!user) {
      // Невдала спроба логіну – анонімний актор
      await this.auditLog.log({
        action: 'login_failed',
        severity: 'warning',
        target: `user_callsign:${dto.callsign}`,
        description: `Невдала спроба входу з позивним "${dto.callsign}"`,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      await this.auditLog.log({
        actorId: user.id,
        actorCallsign: user.callsign,
        actorRole: user.role,
        actorDisplayName: user.displayName ?? null,
        actorIsTwoFactorEnabled: user.isTwoFactorEnabled ?? null,
        action: 'login_failed',
        severity: 'warning',
        target: `user:${user.id}`,
        description: `Невдала спроба входу (невірний пароль) для "${user.callsign}"`,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Успішний логін
    await this.auditLog.log({
      actorId: user.id,
      actorCallsign: user.callsign,
      actorRole: user.role,
      actorDisplayName: user.displayName ?? null,
      actorIsTwoFactorEnabled: user.isTwoFactorEnabled ?? null,
      action: 'login',
      severity: 'info',
      target: `user:${user.id}`,
      description: `Успішний вхід користувача "${user.callsign}"`,
    });

    if (!user.isTwoFactorEnabled) {
      const tokens = this.issueTokens({
        sub: user.id,
        callsign: user.callsign,
        role: user.role,
        isTwoFactorEnabled: false,
        isSecondFactorAuthenticated: true,
      });
      return { user, requires2FA: false, ...tokens };
    }

    const tempAccessToken = this.jwt.sign(
      {
        sub: user.id,
        callsign: user.callsign,
        role: user.role,
        isTwoFactorEnabled: true,
        isSecondFactorAuthenticated: false,
      } as JwtPayload,
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET')!,
        expiresIn: '10m',
      },
    );

    return {
      user,
      requires2FA: true,
      tempAccessToken,
    };
  }

  issueTokens(payload: JwtPayload) {
    const accessOptions: JwtSignOptions = {
      secret: this.config.get<string>('JWT_ACCESS_SECRET')!,
      // config повертає string типу "15m", "1h" і т.п. – це валідний expiresIn
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES')! as any,
    };

    const refreshOptions: JwtSignOptions = {
      secret: this.config.get<string>('JWT_REFRESH_SECRET')!,
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES')! as any,
    };

    const accessToken = this.jwt.sign(payload, accessOptions);
    const refreshToken = this.jwt.sign(payload, refreshOptions);

    return { accessToken, refreshToken };
  }

  async refresh(user: JwtPayload) {
    const { exp, iat, nbf, ...cleanPayload } = user as any;
    const tokens = this.issueTokens(cleanPayload as JwtPayload);
    return tokens;
  }
}
