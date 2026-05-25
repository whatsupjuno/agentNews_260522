import { IsOptional, IsString, Length, Matches } from 'class-validator';

const USER_ID_REGEX = /^[a-zA-Z0-9_]{4,20}$/;

export class RegisterDto {
  @IsString()
  @Length(4, 20)
  @Matches(USER_ID_REGEX, { message: '사용자 ID는 4-20자 영문/숫자/_만 가능' })
  userId!: string;

  @IsString()
  @Length(8, 72)
  password!: string;

  @IsOptional()
  @IsString()
  @Length(1, 40)
  nickname?: string;
}

export class LoginDto {
  @IsString()
  @Length(1, 30)
  userId!: string;

  @IsString()
  @Length(1, 200)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
