import { IsOptional, IsString, Length, Matches } from 'class-validator';

// v3: 10자 이내, 영문/숫자/한글 (underscore 제외)
const USER_ID_REGEX = /^[a-zA-Z0-9가-힣]{1,10}$/;

export class RegisterDto {
  @IsString()
  @Length(1, 10)
  @Matches(USER_ID_REGEX, { message: '사용자 ID는 10자 이내, 영문/숫자/한글만 가능' })
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
