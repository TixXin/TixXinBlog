/** @file 20261105080000_add_presence_invisible.ts @description 实时在线运行配置新增隐身开关，默认关闭，不改变现有站点的对外表现 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20261105080000_add_presence_invisible extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "site_presence" add column "invisible" boolean not null default false;`)
  }
  override async down(): Promise<void> {
    this.addSql(`alter table "site_presence" drop column "invisible";`)
  }
}
