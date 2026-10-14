import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class PurchaseRequestItemDto {
  @ApiProperty() @IsString() productId!: string;
  @ApiProperty({
    description: 'Jumlah dalam UNIT PEMBELIAN yang dipilih. Dikonversi ke base quantity memakai snapshot quantityFactor dari ProductUnit.',
    example: 3,
  })
  @IsInt() @Min(1) quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() productUnitId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() variantId?: string;
  @ApiPropertyOptional({ description: 'Shortcut barcode; harus milik produk yang dipilih dan boleh menunjuk ProductUnit yang sama.' }) @IsOptional() @IsString() barcodeCode?: string;
  @ApiProperty({ description: 'Estimasi biaya per UNIT PEMBELIAN yang dipilih.', example: 36000 }) @IsNumber() @Min(0) estimatedUnitCost!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreatePurchaseRequestDto {
  @ApiProperty() @IsString() warehouseId!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() supplierId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() neededBy?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [PurchaseRequestItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseRequestItemDto) items!: PurchaseRequestItemDto[];
}

export class SubmitPurchaseRequestDto {
  @ApiPropertyOptional({ description: 'Approval policy opsional. Bila kosong, approval satu langkah digunakan.' }) @IsOptional() @IsString() policyId?: string;
}

export class DecidePurchaseRequestDto {
  @ApiProperty({ enum: ['APPROVED', 'REJECTED'] }) @IsIn(['APPROVED', 'REJECTED']) status!: 'APPROVED' | 'REJECTED';
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class ConvertPurchaseRequestDto {
  @ApiPropertyOptional({ description: 'Supplier dapat dilengkapi saat convert bila draft PR belum memilikinya.' }) @IsOptional() @IsString() supplierId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expectedDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
