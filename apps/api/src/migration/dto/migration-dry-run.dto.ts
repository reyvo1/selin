import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MigrationDryRunDto {
  @ApiProperty({ enum: ['products', 'customers', 'suppliers', 'categories'] })
  @IsString()
  @IsIn(['products', 'customers', 'suppliers', 'categories'])
  entityType!: string;

  @ApiProperty({ type: [Object] })
  @IsArray()
  rows!: Record<string, unknown>[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export type MigrationDryRunError = { index: number; field: string; message: string };

export type MigrationDryRunResult = {
  entityType: string;
  dryRun: boolean;
  total: number;
  valid: number;
  invalid: number;
  errors: MigrationDryRunError[];
  warnings: string[];
};