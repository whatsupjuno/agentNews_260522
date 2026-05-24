import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsString()
  attachmentExternalId?: string;
}
