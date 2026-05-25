import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, Max, Min } from 'class-validator';

export class UpdateUserSequenceDto {
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  sequence!: number[];
}
