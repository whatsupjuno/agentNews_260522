import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  Max,
  Min,
} from 'class-validator';

export class SetSequenceConfigDto {
  @IsIn(['chat', 'admin'])
  kind!: 'chat' | 'admin';

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  sequence!: number[];
}
