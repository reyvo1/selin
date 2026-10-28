import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
class PurchaseOrderItemDto {
  @ApiProperty() @IsString() productId!: string;
  @ApiPropertyOptional({ description: 'Variant produk yang dipilih. Jika productUnitId terikat variant, server memvalidasi kecocokannya.' }) @IsOptional() @IsString() variantId?: string;
  @ApiPropertyOptional({ description: 'ProductUnit authoritative. Tanpa nilai ini orderedQty dianggap base unit.' }) @IsOptional() @IsString() productUnitId?: string;
  @ApiPropertyOptional({ description: 'Shortcut barcode; harus milik produk yang dipilih dan boleh menunjuk ProductUnit yang sama.' }) @IsOptional() @IsString() barcodeCode?: string;
  @ApiProperty({ example: 10, description: 'Jumlah dalam unit pembelian yang dipilih. Server mengonversi ke base unit untuk stok.' }) @IsInt() @Min(1) orderedQty!: number;
  @ApiProperty({ example: 10000, description: 'Harga per unit pembelian yang dipilih.' }) @IsNumber() @Min(0) unitCost!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() taxCodeId?: string;
  @ApiPropertyOptional({ default: false, description: 'Mode pajak per baris: true = harga sudah termasuk pajak (inclusive).' }) @IsOptional() @IsBoolean() taxIncluded?: boolean;
}
export class CreatePurchaseOrderDto {
  @ApiPropertyOptional({ description: 'Kunci idempotensi untuk retry aman.' }) @IsOptional() @IsString() idempotencyKey?: string;
  @ApiProperty() @IsString() supplierId!: string;
  @ApiProperty() @IsString() warehouseId!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional({ default: false, description: 'Mode pajak dokumen: true = harga sudah termasuk pajak (inclusive).' }) @IsOptional() @IsBoolean() taxIncluded?: boolean;
  @ApiProperty({ type: [PurchaseOrderItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseOrderItemDto) items!: PurchaseOrderItemDto[];
}
