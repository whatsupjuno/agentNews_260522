import { IsIn, IsString, Length } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @Length(1, 512)
  token!: string; // ExponentPushToken[xxxx]

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}
