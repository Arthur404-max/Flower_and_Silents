import { IsEnum, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ORDER_STATUSES, type OrderStatus } from '@cvetotishina/shared';

export class ListOrdersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @IsEnum(ORDER_STATUSES)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;
}

export class UpdateOrderStatusDto {
  @IsEnum(ORDER_STATUSES)
  status!: OrderStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class AdminProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class OrderNumberPattern {
  @IsString()
  @Matches(/^CT-\d{6}-[A-F0-9]{6}$/)
  number!: string;
}
