import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

export type AnnouncementAudience = 'ALL' | 'STUDENTS' | 'TEACHERS' | 'GROUP';

@Entity('announcements')
export class AnnouncementEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  id!: string;

  @Column({ name: 'author_id', type: 'varchar', length: 64 })
  authorId!: string;

  @Column({ name: 'author_name', type: 'varchar', length: 255, default: '' })
  authorName!: string;

  @Column({ name: 'author_role', type: 'varchar', length: 16, default: '' })
  authorRole!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  body!: string;

  /** ALL | STUDENTS | TEACHERS | GROUP */
  @Index()
  @Column({ type: 'varchar', length: 16, default: 'ALL' })
  audience!: AnnouncementAudience;

  @Column({ name: 'group_id', type: 'varchar', length: 64, nullable: true })
  groupId!: string | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
