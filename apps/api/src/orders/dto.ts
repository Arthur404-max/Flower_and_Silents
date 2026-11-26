import { Type } from 'class-transformer';
import { IsArray, ArrayMaxSize, ArrayMinSize, IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';

export class CartLineDto {
  @IsUUID()
  productId!: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;
}

export class QuoteCartDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  items!: CartLineDto[];

  @IsOptional()
  @IsEnum(['PICKUP', 'DELIVERY'])
  deliveryType: 'PICKUP' | 'DELIVERY' = 'PICKUP';
}

export class CreateOrderDto extends QuoteCartDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  customerName!: string;

  @IsString()
  @Matches(/^\+?[0-9\s()-]{10,20}$/)
  phone!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;

  @IsOptional()
  @IsBoolean()
  utensils: boolean = false;
}

export class DemoPaymentDto {
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  token!: string;
}
