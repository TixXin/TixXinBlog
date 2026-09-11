/** @file 20260911210000_add_about_settings.ts @description 为关于页资料建立空白缺省，不改写既有个人资料或配置 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20260911210000_add_about_settings extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `update site_settings set "values" = "values" || '{"about":{"visible":false,"introduction":"","sections":[]}}'::jsonb where not ("values" ? 'about');`,
    )
  }

  override async down(): Promise<void> {
    // 旧版服务可以忽略扩展 JSON 字段；不删除博主已经填写的资料。
  }
}
