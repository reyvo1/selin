import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class DeclareContinuityCapabilityDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) flowCode!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(160) label!: string;
  @ApiProperty() @IsBoolean() offlineCapable!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) degradedImpact?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() localAuthoritative?: boolean;
}

export class SetNodePolicyDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(80) flowCode!: string;
  @ApiProperty() @IsBoolean() offlineCapable!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) degradedImpact?: string;
}

export class MarkReadWatermarkDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) resource!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(240) sourceCursor?: string;
}

export class ReportConnectivityDto {
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty({ enum: ['ONLINE', 'DEGRADED', 'OFFLINE'] }) @IsIn(['ONLINE', 'DEGRADED', 'OFFLINE']) state!: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) lagCount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

export class RecordBackupMetadataDto {
  @ApiProperty() @IsUUID() nodeId!: string;
  @ApiProperty() @IsDateString() completedAt!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(200) checksum!: string;
  @ApiProperty() @IsInt() @Min(0) sizeBytes!: number;
  @ApiPropertyOptional({ enum: ['LOCAL', 'CENTRAL'] }) @IsOptional() @IsIn(['LOCAL', 'CENTRAL']) kind?: 'LOCAL' | 'CENTRAL';
}

export class VerifyRestoreChecksumDto {
  @ApiProperty() @IsUUID() nodeId!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(200) checksum!: string;
}

export class RejoinBranchDto {
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(60) code!: string;
  @ApiProperty() @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @ApiProperty({ enum: ['CENTRAL', 'BRANCH'] }) @IsIn(['CENTRAL', 'BRANCH']) role!: 'CENTRAL' | 'BRANCH';
  @ApiPropertyOptional() @IsOptional() @IsUUID() branchId?: string;
}

export class RecordRestoreDrillDto {
  @ApiProperty() @IsUUID() nodeId!: string;
  @ApiProperty() @IsDateString() completedAt!: string;
  @ApiProperty() @IsString() @MinLength(8) @MaxLength(200) checksum!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sizeBytes?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() success?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) durationMs?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) rpoMinutes?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) rtoMinutes?: number;
}

export class ScheduleAutobackupDto {
  @ApiProperty() @IsUUID() nodeId!: string;
  @ApiProperty({ enum: ['DAILY', 'WEEKLY', 'MONTHLY'] }) @IsIn(['DAILY', 'WEEKLY', 'MONTHLY']) frequency!: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(10) localTime!: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(6) dayOfWeek?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(31) dayOfMonth?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(365) retentionCount?: number;
  @ApiPropertyOptional({ enum: ['LOCAL', 'CENTRAL'] }) @IsOptional() @IsIn(['LOCAL', 'CENTRAL']) kind?: 'LOCAL' | 'CENTRAL';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
}

export class UpdateAutobackupScheduleDto {
  @ApiPropertyOptional() @IsOptional() @IsIn(['DAILY', 'WEEKLY', 'MONTHLY']) frequency?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(10) localTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(6) dayOfWeek?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(31) dayOfMonth?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() enabled?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(365) retentionCount?: number;
  @ApiPropertyOptional({ enum: ['LOCAL', 'CENTRAL'] }) @IsOptional() @IsIn(['LOCAL', 'CENTRAL']) kind?: 'LOCAL' | 'CENTRAL';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string;
}

export class AcknowledgeTransferArrivalDto {
  @ApiProperty() @IsInt() @Min(0) receivedQuantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class AbandonBranchTransferDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
