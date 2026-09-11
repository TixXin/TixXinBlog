/** @file 20260911224000_add_media_description.ts @description 媒体素材说明与图片替代文本分开保存，既有资源保持空白缺省。 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260911224000_add_media_description extends Migration {
  override async up(): Promise<void> {
    this.addSql("alter table media_asset add column if not exists description text not null default '';")
  }

  override async down(): Promise<void> {
    // 旧版应用可忽略此列；回退应用版本时保留博主已填写的素材说明。
  }
}
