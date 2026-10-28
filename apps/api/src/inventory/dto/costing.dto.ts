import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCostingPolicyDto {
  @ApiPropertyOptional({ description: 'Diabaikan; company selalu berasal dari token.' })
  @IsOptional() @IsString() companyId?: string;

  @ApiPropertyOptional({ description: 'Harus sama dengan branch pada token.' })
  @IsOptional() @IsString() branchId?: string;

  @ApiProperty({ enum: ['MOVING_AVERAGE', 'FIFO', 'LIFO'] })
  @IsIn(['MOVING_AVERAGE', 'FIFO', 'LIFO']) method!: 'MOVING_AVERAGE' | 'FIFO' | 'LIFO';

  @ApiProperty({ enum: ['SHADOW', 'ACTIVE'] })
  @IsIn(['SHADOW', 'ACTIVE']) mode!: 'SHADOW' | 'ACTIVE';

  @ApiProperty({ description: 'Tanggal efektif policy, format ISO-8601.' })
  @IsDateString() effectiveFrom!: string;
}

export class CreateCostingRebuildDto {
  @ApiPropertyOptional({ description: 'Batasi backfill ke gudang tertentu pada branch token.' })
  @IsOptional() @IsString() warehouseId?: string;

  @ApiProperty({ description: 'Tanggal cutover snapshot biaya.' })
  @IsDateString() cutoverAt!: string;

  @ApiProperty({ description: 'Kunci operasi unik untuk replay aman.' })
  @IsString() @MinLength(8) operationKey!: string;
}
