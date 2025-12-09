// src/users/dto/user.dto.ts
import { Role } from '../role.enum';
import type { User } from '../user.entity';

export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended';

export interface UserDto {
  id: string;
  callsign: string;
  displayName: string | null;
  role: Role;
  isTwoFactorEnabled: boolean;
  status: UserStatus;
}

export function mapUserToDto(user: User): UserDto {
  // Поки що всі існуючі користувачі вважаються "active"
  const status: UserStatus = 'active';

  return {
    id: user.id,
    callsign: user.callsign,
    displayName: user.displayName ?? null,
    role: user.role,
    isTwoFactorEnabled: user.isTwoFactorEnabled,
    status,
  };
}
