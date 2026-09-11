/** @file 20260911225000_sanitize_initial_profile.ts @description 仅收起未经编辑的旧初始资料；保留原历史，不回退公开未经确认的事实。 */
import { Migration } from '@mikro-orm/migrations'
export class Migration20260911225000_sanitize_initial_profile extends Migration {
  override async up(): Promise<void> {
    // 固定历史默认值，不依赖后续可变的业务常量；about是后续无损增加的空白字段。
    const initial = `{"name":"TixXin Blog","description":"TixXin 的个人博客，分享技术文章、项目经验与生活随笔","ownerName":"TixXin","ownerTitle":"前端开发工程师，热爱开源与技术分享","avatar":"/avatar-photo.webp","avatarAlt":"TixXin 的头像","seoTitle":"","seoDescription":"","announcement":"","announcementUpdatedAt":"","socials":[{"icon":"lucide:github","label":"GitHub","href":"https://github.com/TixXin"},{"icon":"lucide:twitter","label":"Twitter","href":"https://twitter.com/TixXin"},{"icon":"lucide:mail","label":"Email","href":"mailto:hi@tix.xin"}]}`
    this.addSql(`with eligible as (
      select s.id, s."values" || '{"ownerName":"tixxin","ownerTitle":"","avatar":"/avatar.svg","avatarAlt":"博主头像","socials":[],"about":{"visible":false,"introduction":"","sections":[]}}'::jsonb as safe_values
      from site_settings s join site_settings_revision r on r.revision=0
      where s.id='default' and s.revision=0 and r.reason='初始站点资料'
        and (s."values"-'about')=(r."values"-'about') and (r."values"-'about')='${initial}'::jsonb
        and coalesce(s."values"->'about','{"visible":false,"introduction":"","sections":[]}'::jsonb)='{"visible":false,"introduction":"","sections":[]}'::jsonb
        and coalesce(r."values"->'about','{"visible":false,"introduction":"","sections":[]}'::jsonb)='{"visible":false,"introduction":"","sections":[]}'::jsonb
        and not exists(select 1 from site_settings_revision where revision=1)
      for update of s
    ), changed as (
      update site_settings s set "values"=e.safe_values,revision=1,updated_at=now() from eligible e
      where s.id=e.id and s.revision=0 returning s."values",s.updated_at
    ) insert into site_settings_revision(revision,"values",reason,created_at)
      select 1,"values",'收起未经确认的初始个人资料',updated_at from changed;`)
  }
  override async down(): Promise<void> {
    // 应用回退也不能自动重新公开旧头衔、社交地址或人物肖像；已保存版本和历史继续保留。
  }
}
