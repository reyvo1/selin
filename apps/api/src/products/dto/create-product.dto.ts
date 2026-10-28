import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { IsHttpImageUrl } from '../../common/validation/is-http-image-url';

export class CreateProductDto {
  @ApiProperty({ example: 'SKU-001' }) @IsString() sku!: string;
  @ApiPropertyOptional({ example: '899000000001' }) @IsOptional() @IsString() barcode?: string;
  @ApiProperty({ example: 'Produk Contoh' }) @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ description: 'URL foto produk (http/https, tanpa basic-auth, tanpa query token). Presentasi saja: tidak memengaruhi harga, pajak, stok, atau jurnal.' })
  @IsOptional() @IsHttpImageUrl() imageUrl?: string;
  @ApiPropertyOptional({ description: 'URL datasheet/dokumen teknis produk (http/https). Presentasi saja: tidak memengaruhi harga, pajak, stok, atau jurnal.' })
  @IsOptional() @IsString() @MaxLength(2048) datasheetUrl?: string;
  @ApiPropertyOptional({ description: 'Datasheet terstruktur produk (atribut + lampiran). Presentasi saja.' })
  @IsOptional() datasheet?: any;
  @ApiPropertyOptional({ description: 'Atribut datasheet produk (key/value). Presentasi saja.' })
  @IsOptional() datasheetAttributes?: any;
  @ApiPropertyOptional({ description: 'Lampiran datasheet produk (array). Presentasi saja.' })
  @IsOptional() datasheetAttachments?: any;
  @ApiPropertyOptional({ description: 'Spesifikasi datasheet produk. Presentasi saja.' })
  @IsOptional() datasheetSpecs?: any;
  @ApiPropertyOptional({ description: 'File/lampiran datasheet produk. Presentasi saja.' })
  @IsOptional() datasheetFiles?: any;
  @ApiPropertyOptional({ description: 'Atribut teknis produk. Presentasi saja.' })
  @IsOptional() attributes?: any;
  @ApiPropertyOptional({ description: 'Lampiran produk. Presentasi saja.' })
  @IsOptional() attachments?: any;
  @ApiPropertyOptional() @IsOptional() @IsString() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() brandCode?: string;
  @ApiProperty({ example: 'BATANG', description: 'Base unit aktif dari master UNIT perusahaan. Gunakan unit fisik terkecil yang benar-benar distok.' }) @IsString() @MaxLength(60) unit!: string;
  @ApiPropertyOptional({ enum: ['PHYSICAL', 'SERVICE', 'NON_INVENTORY', 'ASSEMBLY', 'EXPENSE'], default: 'PHYSICAL' }) @IsOptional() @IsIn(['PHYSICAL', 'SERVICE', 'NON_INVENTORY', 'ASSEMBLY', 'EXPENSE']) productType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) taxCategoryCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() salesTaxCodeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() purchaseTaxCodeId?: string;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() trackBatch?: boolean;
  @ApiPropertyOptional({ default: false, description: 'Expiry wajib dicatat per batch dan batch kedaluwarsa tidak boleh dipenuhi ke penjualan.' }) @IsOptional() @IsBoolean() trackExpiry?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() trackSerial?: boolean;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() allowNegativeStock?: boolean;
  @ApiProperty({ example: 10000 }) @IsNumber() @Min(0) costPrice!: number;
  @ApiProperty({ example: 15000 }) @IsNumber() @Min(0) salePrice!: number;
  @ApiPropertyOptional({ description: 'Harga Eceran Tertinggi (HET) per base unit. Harga jual/override tidak boleh melampaui nilai ini bila diisi.' }) @IsOptional() @IsNumber() @Min(0) retailCeilingPrice?: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsInt() @Min(0) minStock?: number;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
