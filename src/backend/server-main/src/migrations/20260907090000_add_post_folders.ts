/**
 * @file 20260907090000_add_post_folders.ts
 * @description 建立专栏目录并回填全部现存名称，不改动文章内容。
 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260907090000_add_post_folders extends Migration {
  override async up(): Promise<void> {
    this.addSql('create table "post_folder" ("id" serial primary key, "label" text not null);')
    this.addSql('alter table "post_folder" add constraint "post_folder_label_unique" unique ("label");')
    this.addSql('insert into "post_folder" ("label") select distinct "folder" from "post";')
  }
  override async down(): Promise<void> {
    // 目录可重建，文章中的专栏名称完整保留。
    this.addSql('drop table "post_folder";')
  }
}
