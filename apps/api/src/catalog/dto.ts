import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsIn(['popular', 'price-asc', 'price-desc', 'newest'])
  sort: 'popular' | 'price-asc' | 'price-desc' | 'newest' = 'popular';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  limit: number = 12;
}

export class CreateCategoryDto {
  @IsString()
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,80}$/)
  slug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder: number = 0;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,80}$/)
  slug?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateProductDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,90}$/)
  slug?: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsString()
  @MaxLength(1000)
  composition!: string;

  @IsString()
  @MaxLength(100)
  size!: string;

  @IsInt()
  @Min(0)
  @Max(10_000_000)
  price!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  oldPrice?: number | null;

  @IsString()
  @Matches(/^(\/images\/|\/uploads\/|https:\/\/)/)
  @MaxLength(500)
  imageUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  badge?: string | null;

  @IsInt()
  @Min(0)
  @Max(100_000)
  stock!: number;
}

export class UpdateProductDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]{2,90}$/)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  composition?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  size?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  oldPrice?: number | null;

  @IsOptional()
  @IsString()
  @Matches(/^(\/images\/|\/uploads\/|https:\/\/)/)
  @MaxLength(500)
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  badge?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
