import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class IngestAuditDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  userRole?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  userName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  resource?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  method!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  path!: string;

  @IsInt()
  @Min(0)
  @Max(599)
  statusCode!: number;

  @IsIn(['ALLOWED', 'DENIED', 'ERROR'])
  status!: 'ALLOWED' | 'DENIED' | 'ERROR';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ip?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestId?: string;
}

export class AuditQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['ALLOWED', 'DENIED', 'ERROR'])
  status?: 'ALLOWED' | 'DENIED' | 'ERROR';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
