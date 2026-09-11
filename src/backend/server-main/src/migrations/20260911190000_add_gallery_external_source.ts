/** @file 20260911190000_add_gallery_external_source.ts @description 原地扩展作品来源，旧媒体关联和作品编号保持不变 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260911190000_add_gallery_external_source extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "gallery_photo" alter column "media_id" drop not null;')
    this.addSql('alter table "gallery_photo" add column "external_url" text null;')
    this.addSql(
      `alter table "gallery_photo" add constraint "gallery_photo_source_check" check ((media_id is not null and external_url is null) or (media_id is null and external_url is not null and length(external_url) > 0));`,
    )
  }

  override async down(): Promise<void> {
    // 存在外链时拒绝降级，不删除作品或伪造受管媒体。
    this.addSql('alter table "gallery_photo" alter column "media_id" set not null;')
    this.addSql('alter table "gallery_photo" drop constraint "gallery_photo_source_check";')
    this.addSql('alter table "gallery_photo" drop column "external_url";')
  }
}
