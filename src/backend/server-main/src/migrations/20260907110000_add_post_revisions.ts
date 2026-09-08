/**
 * @file 20260907110000_add_post_revisions.ts
 * @description 内容版本和初始修订回填，完整保留旧正文块和互动计数。
 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260907110000_add_post_revisions extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "post" add column "revision" int not null default 0;')
    this.addSql(
      'create table "post_revision" ("id" serial primary key, "post_id" int not null, "revision" int not null, "snapshot" jsonb not null, "reason" text not null, "created_at" timestamptz not null);',
    )
    this.addSql(
      'alter table "post_revision" add constraint "post_revision_post_id_revision_unique" unique ("post_id", "revision");',
    )
    this.addSql(
      'alter table "post_revision" add constraint "post_revision_post_id_foreign" foreign key ("post_id") references "post" ("id") on update cascade on delete cascade;',
    )
    this.addSql(`insert into post_revision(post_id,revision,snapshot,reason,created_at)
      select p.id,0,jsonb_build_object('title',p.title,'summary',p.summary,'cover',coalesce(p.cover,''),'folder',p.folder,
        'category',p.category,'contentRaw',coalesce(p.content_raw,''),'contentSections',p.content_sections,
        'readTimeMinutes',p.read_time_minutes,'status',p.status,'pinned',p.pinned,
        'tags',coalesce((select jsonb_agg(t.label order by t.label) from post_tag t join post_tag_map m on m.post_tag_id=t.id where m.post_id=p.id),'[]'::jsonb)),
        '初始版本',p.updated_at from post p;`)
  }
  override async down(): Promise<void> {
    this.addSql('drop table "post_revision";')
    this.addSql('alter table "post" drop column "revision";')
  }
}
