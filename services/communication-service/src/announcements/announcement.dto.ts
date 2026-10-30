import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsIn(['ALL', 'STUDENTS', 'TEACHERS', 'GROUP'])
  audience?: 'ALL' | 'STUDENTS' | 'TEACHERS' | 'GROUP';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupId?: string;
}
