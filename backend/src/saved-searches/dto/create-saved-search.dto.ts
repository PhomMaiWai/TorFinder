import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from "class-validator";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

/**
 * What the search page had set when it was saved. The values are the search
 * page's own keys (sort key, status, deadline and budget bucket ids), stored
 * as given and handed back as given — the page decides what they mean, so a
 * new filter there needs no change here beyond a field. Sizes are capped so
 * one row can't grow without bound.
 */
export class SearchFiltersDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  sort?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  statuses?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(32)
  deadline?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  years?: number[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  agencies?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(32, { each: true })
  budgets?: string[];
}

export class CreateSavedSearchDto {
  @Transform(trim)
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => SearchFiltersDto)
  filters!: SearchFiltersDto;
}
