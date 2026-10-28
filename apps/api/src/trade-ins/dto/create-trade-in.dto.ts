import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateTradeInDto {
  @ApiProperty({ description: 'Produk asli yang ditukar.' })
  @IsString()
  originalProductId!: string;

  @ApiPropertyOptional({ description: 'Produk baru yang diperoleh dari tukar tambah.' })
  @IsOptional()
  @IsString()
  newProductId?: string;

  @ApiProperty({ example: 100000, description: 'Nilai tukar produk asli.' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tradeValue!: number;

  @ApiPropertyOptional({ description: 'Status trade-in (default DRAFT).' })
  @IsOptional()
  @IsString()
  status?: string;
}
