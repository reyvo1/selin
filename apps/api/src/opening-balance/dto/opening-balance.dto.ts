import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const OPENING_BALANCE_TYPES = ['STOCK', 'AR', 'AP', 'GL'] as const;
export type OpeningBalanceTypeValue = (typeof OPENING_BALANCE_TYPES)[number];

export class OpeningBalanceRowDto {
  @ApiPropertyOptional({ description: 'Wajib untuk tipe STOCK.' })
  @IsOptional() @IsString() productId?: string;

  @ApiPropertyOptional({ description: 'Wajib untuk tipe STOCK.' })
  @IsOptional() @IsString() warehouseId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) locationCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) batchNumber?: string;

  @ApiPropertyOptional({ description: 'Format ISO-8601.' })
  @IsOptional() @IsDateString() expiryDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) quantity?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) unitCost?: number;

  @ApiPropertyOptional({ description: 'Wajib untuk tipe AR.' })
  @IsOptional() @IsString() customerId?: string;

  @ApiPropertyOptional({ description: 'Wajib untuk tipe AP.' })
  @IsOptional() @IsString() supplierId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) documentNumber?: string;

  @ApiPropertyOptional({ description: 'Format ISO-8601.' })
  @IsOptional() @IsDateString() documentDate?: string;

  @ApiPropertyOptional({ description: 'Format ISO-8601.' })
  @IsOptional() @IsDateString() dueDate?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) subtotal?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() taxCodeId?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) taxCodeVersion?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) taxAmount?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) total?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) paidAmount?: number;

  @ApiPropertyOptional({ description: 'Wajib untuk baris GL.' })
  @IsOptional() @IsString() @MaxLength(32) accountCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) debit?: number;

  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) credit?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) description?: string;
}

export class PreviewOpeningBalanceBatchDto {
  @ApiProperty({ enum: OPENING_BALANCE_TYPES })
  @IsIn(OPENING_BALANCE_TYPES) type!: OpeningBalanceTypeValue;

  @ApiProperty({ description: 'Tanggal cutover saldo awal, format ISO-8601.' })
  @IsDateString() cutoverDate!: string;

  @ApiPropertyOptional({ description: 'Nama file sumber, maksimal 255 karakter.' })
  @IsOptional() @IsString() @MaxLength(255) sourceFileName?: string;

  @ApiPropertyOptional({ description: 'Isi CSV. Tidak boleh dikirim bersama rows.' })
  @IsOptional() @IsString() @MaxLength(2_000_000) csv?: string;

  @ApiPropertyOptional({ type: [OpeningBalanceRowDto], description: 'Maksimal 1000 baris. Tidak boleh dikirim bersama csv.' })
  @IsOptional() @IsArray() @ArrayMaxSize(1000) @ValidateNested({ each: true }) @Type(() => OpeningBalanceRowDto) rows?: OpeningBalanceRowDto[];

  @ApiPropertyOptional({ default: false, description: 'Dry-run tidak menyimpan batch dan tidak memerlukan operationKey.' })
  @IsOptional() @IsBoolean() dryRun?: boolean;

  @ApiPropertyOptional({ description: 'Akun kontrol AR/AP atau debit untuk STOCK/GL.' })
  @IsOptional() @IsString() @MaxLength(32) controlAccountCode?: string;

  @ApiPropertyOptional({ description: 'Akun lawan untuk batch saldo awal.' })
  @IsOptional() @IsString() @MaxLength(32) offsetAccountCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) suspenseAccountCode?: string;
}

export class CreateOpeningBalanceBatchDto extends PreviewOpeningBalanceBatchDto {
  @ApiProperty({ description: 'Kunci operasi unik untuk replay aman.' })
  @IsString() @MinLength(8) @MaxLength(200) operationKey!: string;
}

export class RevalidateOpeningBalanceBatchDto {
  @ApiPropertyOptional({ description: 'Alasan validasi ulang untuk audit.' })
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class CancelOpeningBalanceBatchDto {
  @ApiProperty({ description: 'Alasan pembatalan batch.' })
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}

export class ApproveOpeningBalanceBatchDto {
  @ApiPropertyOptional({ description: 'Catatan approval.' })
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class SettleOpeningLedgerDto {
  @ApiProperty({ description: 'ID dokumen ledger saldo awal.' })
  @IsString() @MinLength(1) documentId!: string;

  @ApiProperty({ description: 'ID transaksi keuangan POSTED.' })
  @IsString() @MinLength(1) financeTransactionId!: string;

  @ApiProperty({ description: 'Jumlah settlement.' })
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;

  @ApiProperty({ description: 'Kunci operasi unik untuk replay aman.' })
  @IsString() @MinLength(8) @MaxLength(200) operationKey!: string;
}

export class YearEndCloseDto {
  @ApiProperty({ description: 'Tahun fiskal yang ditutup.' })
  @IsInt() @Min(2000) fiscalYear!: number;

  @ApiProperty({ description: 'Kode akun laba ditahan.' })
  @IsString() @MinLength(1) @MaxLength(32) retainedEarningsAccountCode!: string;

  @ApiProperty({ description: 'Kode akun income summary.' })
  @IsString() @MinLength(1) @MaxLength(32) incomeSummaryAccountCode!: string;

  @ApiProperty({ description: 'Kunci operasi unik untuk replay aman.' })
  @IsString() @MinLength(8) @MaxLength(200) operationKey!: string;
}

export class ReverseYearEndCloseDto {
  @ApiPropertyOptional({ description: 'Alasan pembalikan.' })
  @IsOptional() @IsString() @MaxLength(500) reason?: string;

  @ApiPropertyOptional({ description: 'Kunci operasi unik untuk replay aman.' })
  @IsOptional() @IsString() @MinLength(8) @MaxLength(200) operationKey?: string;
}

export class ReverseOpeningBalanceBatchDto {
  @ApiProperty({ description: 'Alasan pembalikan batch.' })
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;

  @ApiPropertyOptional({ description: 'Tanggal pembalikan, format ISO-8601.' })
  @IsOptional() @IsDateString() businessDate?: string;

  @ApiPropertyOptional({ description: 'Kunci operasi unik untuk replay aman.' })
  @IsOptional() @IsString() @MinLength(8) @MaxLength(200) operationKey?: string;

  @ApiPropertyOptional({ description: 'Kunci idempotensi alternatif.' })
  @IsOptional() @IsString() @MinLength(8) @MaxLength(200) idempotencyKey?: string;
}
