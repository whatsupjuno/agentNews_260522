import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Max, Min } from 'class-validator';

export class VerifySequenceDto {
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(99, { each: true })
  sequence!: number[];
}
