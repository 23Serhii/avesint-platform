import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { UsersService } from '../users/users.service';

@Injectable()
export class TwoFactorService {
  constructor(private usersService: UsersService) {}

  async generateSecret(userId: string) {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(userId, 'Avesint', secret);

    await this.usersService.setTwoFactorSecret(userId, secret);

    const qrCode = await qrcode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCode };
  }

  isCodeValid(token: string, secret: string) {
    return authenticator.verify({ token, secret });
  }

  async enable(userId: string) {
    await this.usersService.enableTwoFactor(userId);
  }
}
