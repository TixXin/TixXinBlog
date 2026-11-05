/** @file 20261105184801_moment_comment_reply_and_reactions.ts @description 朋友圈评论新增回复关系列，新增表情回应表；禁止破坏性回退 */
import { Migration } from '@mikro-orm/migrations'

export class Migration20261105184801_moment_comment_reply_and_reactions extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "moment_reaction" ("id" serial primary key, "moment_id" text not null, "visitor_id_hash" text not null, "emoji" text not null, "created_at" timestamptz not null);`,
    )
    this.addSql(`create index "moment_reaction_moment_id_emoji_index" on "moment_reaction" ("moment_id", "emoji");`)
    this.addSql(
      `alter table "moment_reaction" add constraint "moment_reaction_unique" unique ("moment_id", "visitor_id_hash", "emoji");`,
    )
    this.addSql(
      `alter table "moment_reaction" add constraint "moment_reaction_moment_id_foreign" foreign key ("moment_id") references "moment" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(`alter table "moment_comment" add column "reply_to_id" text null;`)
    this.addSql(
      `alter table "moment_comment" add constraint "moment_comment_reply_to_id_foreign" foreign key ("reply_to_id") references "moment_comment" ("id") on update cascade on delete set null;`,
    )
    this.addSql(`create index "moment_comment_reply_to_id_index" on "moment_comment" ("reply_to_id");`)
  }

  override async down(): Promise<void> {
    throw new Error('朋友圈回复与回应迁移不可逆；回退应用时保留回复关系列与回应记录')
  }
}
