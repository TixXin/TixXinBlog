/** @file 20261016202100_add_guestbook_client_context.ts @description 留言新增浏览器与地区两列，展示访客来源；不回退 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20261016202100_add_guestbook_client_context extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "guestbook_message" add column "browser" text null, add column "region" text null;`)
  }
  override async down(): Promise<void> {
    throw new Error('留言来源字段迁移不可逆；回退应用时保留已记录的浏览器与地区')
  }
}
