import { IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  callsign: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  displayName: string;
}
