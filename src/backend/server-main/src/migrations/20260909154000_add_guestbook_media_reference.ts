/** @file 20260909154000_add_guestbook_media_reference.ts @description 留言媒体引用关联，删除业务记录时同步释放引用索引 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260909154000_add_guestbook_media_reference extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "media_reference" add column "guestbook_message_id" int null;')
    this.addSql(
      'alter table "media_reference" add constraint "media_reference_guestbook_message_id_foreign" foreign key ("guestbook_message_id") references "guestbook_message" ("id") on update cascade on delete cascade;',
    )
  }
  override async down(): Promise<void> {
    this.addSql('alter table "media_reference" drop column "guestbook_message_id";')
  }
}
