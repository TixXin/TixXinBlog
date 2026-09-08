/**
 * @file 20260907220000_add_comment_media_references.ts
 * @description 将评论头像纳入媒体引用，并通过级联在删除评论时释放引用。
 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260907220000_add_comment_media_references extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table media_reference add column comment_id int null, add column flash_comment_id text null;')
    this.addSql(
      'alter table media_reference add constraint media_reference_comment_id_foreign foreign key (comment_id) references comment (id) on update cascade on delete cascade;',
    )
    this.addSql(
      'alter table media_reference add constraint media_reference_flash_comment_id_foreign foreign key (flash_comment_id) references flash_comment (id) on update cascade on delete cascade;',
    )
    this.addSql(
      "insert into media_reference (asset_id,source_key,kind,post_id,comment_id) select a.id,'comment:'||c.id,'comment',c.post_id,c.id from comment c join media_asset a on lower(c.author_snapshot->>'avatar') like '%/api/v1/media/'||a.id::text||'.webp%' on conflict (asset_id,source_key) do nothing;",
    )
    this.addSql(
      "insert into media_reference (asset_id,source_key,kind,flash_note_id,flash_comment_id) select a.id,'flash-comment:'||c.id,'flash-comment',c.flash_note_id,c.id from flash_comment c join media_asset a on lower(c.author_avatar) like '%/api/v1/media/'||a.id::text||'.webp%' on conflict (asset_id,source_key) do nothing;",
    )
  }
  override async down(): Promise<void> {
    this.addSql("delete from media_reference where kind in ('comment','flash-comment');")
    this.addSql('alter table media_reference drop column comment_id, drop column flash_comment_id;')
  }
}
