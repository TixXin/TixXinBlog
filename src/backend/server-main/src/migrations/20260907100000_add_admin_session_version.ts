/**
 * @file 20260907100000_add_admin_session_version.ts
 * @description 为管理员增加会话版本，不修改现有密码或账号。
 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260907100000_add_admin_session_version extends Migration {
  override async up(): Promise<void> {
    this.addSql('alter table "admin_user" add column "session_version" int not null default 0;')
  }
  override async down(): Promise<void> {
    this.addSql('alter table "admin_user" drop column "session_version";')
  }
}
