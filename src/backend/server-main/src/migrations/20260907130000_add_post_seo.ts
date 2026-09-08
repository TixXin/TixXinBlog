/**
 * @file 20260907130000_add_post_seo.ts
 * @description 文章 SEO、封面描述和历史地址，保留原数字地址。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907130000_add_post_seo extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'alter table "post" add column "cover_alt" text null, add column "seo_title" text null, add column "seo_description" text null, add column "seo_noindex" boolean not null default false;',
    )
    this.addSql(
      'create table "post_address" ("slug" text not null, "post_id" int not null, constraint "post_address_pkey" primary key ("slug"));',
    )
    this.addSql(
      'alter table "post_address" add constraint "post_address_post_id_foreign" foreign key ("post_id") references "post" ("id") on update cascade on delete cascade;',
    )
    this.addSql("insert into post_address(slug,post_id) select slug,id from post where slug is not null and slug<>'';")
  }
  override async down(): Promise<void> {
    this.addSql('drop table "post_address";')
    this.addSql(
      'alter table "post" drop column "cover_alt", drop column "seo_title", drop column "seo_description", drop column "seo_noindex";',
    )
  }
}
