import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 72)
  password!: string;

  @IsString()
  @Length(2, 40)
  nickname!: string;

  // 사용자 ID — handoff §8.2. 4-20자, 영문/숫자/_
  @IsString()
  @Length(4, 20)
  @Matches(/^[a-zA-Z0-9_]+$/)
  userId!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(1, 200)
  password!: string;
}

export class RefreshDto {
  @IsString()
  refreshToken!: string;
}
