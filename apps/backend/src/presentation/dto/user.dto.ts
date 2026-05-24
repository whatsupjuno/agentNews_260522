import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @Length(2, 40)
  nickname?: string;

  @IsOptional()
  @IsString()
  @Length(0, 80)
  statusMessage?: string;
}
