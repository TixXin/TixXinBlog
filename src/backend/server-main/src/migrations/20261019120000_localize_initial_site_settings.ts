/**
 * @file 20261019120000_localize_initial_site_settings.ts
 * @description 站点默认语言为 en 时，把从未编辑过的中文初始站点资料改为英文；博主编辑过的资料一律不动，不回退
 * @author TixXin
 * @since 2026-10-19
 */
import { Migration } from '@mikro-orm/migrations'

/** 固定历史值，不依赖后续可变的业务常量；与 20260907180000_add_site_settings 写入的中文初始资料一致 */
const ZH = { ownerName: '博主', avatarAlt: '博主头像', reason: '初始站点资料' }
/** 须与 initial-profile.ts 的 SAFE_INITIAL_SITE_VALUES_EN、INITIAL_PROFILE_REASON_EN 一致 */
const EN = { ownerName: 'Blogger', avatarAlt: 'Blogger avatar', reason: 'Initial site settings' }

export class Migration20261019120000_localize_initial_site_settings extends Migration {
  override async up(): Promise<void> {
    // 只认 SITE_DEFAULT_LOCALE=en（生产编排由 NUXT_PUBLIC_DEFAULT_LOCALE 映射），其余值保持中文、不产生任何语句。
    // 迁移执行一次即记录在案；部署时未设置 en 的库之后再改语言，不会被本迁移改写。
    if (process.env.SITE_DEFAULT_LOCALE?.trim() !== 'en') return
    // 「从未编辑」：当前仍是修订 0、没有任何后续修订、修订原因仍是中文初始原因，且当前值与修订 0 一致
    // （about 是后续无损增加的空白字段，比较时忽略）。只改写与中文初始值逐字一致的字段，其余字段原样保留。
    // 改写后修订原因不再是中文初始原因，重复执行时 WHERE 匹配 0 行，可以安全重放。
    this.addSql(`with eligible as (
      select s.id,
        (case when s."values"->>'ownerName'='${ZH.ownerName}' then '{"ownerName":"${EN.ownerName}"}'::jsonb else '{}'::jsonb end)
        || (case when s."values"->>'avatarAlt'='${ZH.avatarAlt}' then '{"avatarAlt":"${EN.avatarAlt}"}'::jsonb else '{}'::jsonb end) as patch
      from site_settings s join site_settings_revision r on r.revision=0
      where s.id='default' and s.revision=0 and r.reason='${ZH.reason}'
        and not exists(select 1 from site_settings_revision where revision<>0)
        and (s."values"-'about')=(r."values"-'about')
      for update of s
    ), settings as (
      update site_settings s set "values"=s."values" || e.patch from eligible e where s.id=e.id returning s.id
    ) update site_settings_revision r set "values"=r."values" || e.patch, reason='${EN.reason}'
      from eligible e where r.revision=0;`)
  }

  override async down(): Promise<void> {
    // 不把英文初始资料改回中文：迁移后博主可能已在此基础上编辑，自动回退会覆盖其内容。
  }
}
