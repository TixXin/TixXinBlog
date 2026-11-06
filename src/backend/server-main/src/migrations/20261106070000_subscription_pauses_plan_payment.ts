/** @file 20261106070000_subscription_pauses_plan_payment.ts @description 订阅新增暂停区间、套餐名与仅后台可见的付款方式；禁止破坏性回退 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20261106070000_subscription_pauses_plan_payment extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table "subscription" add column "paused_periods" jsonb not null default '[]', add column "plan_name" text null, add column "payment_method" text null;`,
    )
  }

  override async down(): Promise<void> {
    throw new Error('订阅暂停区间迁移不可逆；回退应用时保留暂停区间、套餐名与付款方式')
  }
}
