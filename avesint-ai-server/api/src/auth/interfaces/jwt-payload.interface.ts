import { Role } from '../../users/role.enum';

export interface JwtPayload {
  sub: string;
  callsign: string;
  role: Role;
  isTwoFactorEnabled: boolean;
  isSecondFactorAuthenticated?: boolean;
}
