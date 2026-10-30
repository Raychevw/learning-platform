import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class RubricCriterionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  max!: number;
}

export class CreateAssignmentBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  courseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  courseTitle?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;

  @IsISO8601()
  deadline!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  rubricTitle?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RubricCriterionDto)
  criteria?: RubricCriterionDto[];
}

export class SubmitBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  group?: string;
}

export class GradeBodyDto {
  @IsString()
  @IsNotEmpty()
  submissionId!: string;

  @IsOptional()
  @IsIn(['STANDARD', 'LATE_PENALTY', 'EXCELLENCE_BONUS'])
  rule?: 'STANDARD' | 'LATE_PENALTY' | 'EXCELLENCE_BONUS';

  @IsObject()
  criteriaScores!: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  feedback?: string;

  /** Teacher explicitly overrides the automatic late penalty. */
  @IsOptional()
  @IsBoolean()
  overrideLate?: boolean;
}

export class CreateGroupBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  faculty?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  studyYear?: number;
}

export class EnrollStudentBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  userId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  studentName?: string;
}
