/**
 * @file 20260907180000_add_site_settings.ts
 * @description 将已有站点基础资料设为初始可管理配置，不复制演示公告和虚构运行统计。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907180000_add_site_settings extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      'create table "site_settings" ("id" text not null, "revision" int not null default 0, "values" jsonb not null, "updated_at" timestamptz not null, constraint "site_settings_pkey" primary key ("id"));',
    )
    this.addSql(
      'create table "site_settings_revision" ("revision" int not null, "values" jsonb not null, "reason" text not null, "created_at" timestamptz not null, constraint "site_settings_revision_pkey" primary key ("revision"));',
    )
    this.addSql(
      `insert into "site_settings" ("id","revision","values","updated_at") values ('default',0,'{"name":"TixXin Blog","description":"TixXin 的个人博客，分享技术文章、项目经验与生活随笔","ownerName":"TixXin","ownerTitle":"前端开发工程师，热爱开源与技术分享","avatar":"/avatar-photo.webp","avatarAlt":"TixXin 的头像","seoTitle":"","seoDescription":"","announcement":"","announcementUpdatedAt":"","socials":[{"icon":"lucide:github","label":"GitHub","href":"https://github.com/TixXin"},{"icon":"lucide:twitter","label":"Twitter","href":"https://twitter.com/TixXin"},{"icon":"lucide:mail","label":"Email","href":"mailto:hi@tix.xin"}]}',now());`,
    )
    this.addSql(
      `insert into "site_settings_revision" ("revision","values","reason","created_at") select revision,"values",'初始站点资料',updated_at from site_settings;`,
    )
  }
  override async down(): Promise<void> {
    this.addSql('drop table "site_settings_revision";')
    this.addSql('drop table "site_settings";')
  }
}
