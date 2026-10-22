import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateCostingPolicyDto {
  @ApiPropertyOptional({ description: 'Diabaikan; company selalu berasal dari token.' })
  @IsOptional() @IsString() companyId?: string;

  @ApiPropertyOptional({ description: 'Harus sama dengan branch pada token.' })
  @IsOptional() @IsString() branchId?: string;

  @ApiProperty({ enum: ['MOVING_AVERAGE'] })
  @IsIn(['MOVING_AVERAGE']) method!: 'MOVING_AVERAGE';

  @ApiProperty({ enum: ['SHADOW', 'ACTIVE'] })
  @IsIn(['SHADOW', 'ACTIVE']) mode!: 'SHADOW' | 'ACTIVE';

  @ApiProperty({ description: 'Tanggal efektif policy, format ISO-8601.' })
  @IsDateString() effectiveFrom!: string;
}
