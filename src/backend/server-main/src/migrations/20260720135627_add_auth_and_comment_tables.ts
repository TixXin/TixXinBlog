import { Migration } from '@mikro-orm/migrations'

export class Migration20260720135627_add_auth_and_comment_tables extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `create table "admin_user" ("id" uuid not null, "username" text not null, "password_hash" text not null, "created_at" timestamptz not null, "last_login_at" timestamptz null, constraint "admin_user_pkey" primary key ("id"));`,
    )
    this.addSql(`alter table "admin_user" add constraint "admin_user_username_unique" unique ("username");`)

    this.addSql(
      `create table "comment" ("id" serial primary key, "post_id" int not null, "parent_id" int null, "depth" int not null default 0, "author_snapshot" jsonb not null, "content" text not null, "likes" int not null default 0, "is_owner" boolean not null default false, "created_at" timestamptz not null);`,
    )
    this.addSql(`create index "comment_post_id_index" on "comment" ("post_id");`)

    this.addSql(
      `create table "comment_like" ("id" serial primary key, "comment_id" int not null, "visitor_id_hash" text not null, "created_at" timestamptz not null);`,
    )
    this.addSql(
      `alter table "comment_like" add constraint "comment_like_comment_id_visitor_id_hash_unique" unique ("comment_id", "visitor_id_hash");`,
    )

    this.addSql(
      `create table "refresh_token" ("id" serial primary key, "admin_user_id" uuid not null, "token_hash" text not null, "device_id" text null, "user_agent" text null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, "created_at" timestamptz not null);`,
    )
    this.addSql(`create index "refresh_token_admin_user_id_index" on "refresh_token" ("admin_user_id");`)
    this.addSql(`alter table "refresh_token" add constraint "refresh_token_token_hash_unique" unique ("token_hash");`)

    this.addSql(
      `alter table "comment" add constraint "comment_post_id_foreign" foreign key ("post_id") references "post" ("id") on update cascade on delete cascade;`,
    )
    this.addSql(
      `alter table "comment" add constraint "comment_parent_id_foreign" foreign key ("parent_id") references "comment" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table "comment_like" add constraint "comment_like_comment_id_foreign" foreign key ("comment_id") references "comment" ("id") on update cascade on delete cascade;`,
    )

    this.addSql(
      `alter table "refresh_token" add constraint "refresh_token_admin_user_id_foreign" foreign key ("admin_user_id") references "admin_user" ("id") on update cascade on delete cascade;`,
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "refresh_token" drop constraint "refresh_token_admin_user_id_foreign";`)

    this.addSql(`alter table "comment" drop constraint "comment_parent_id_foreign";`)

    this.addSql(`alter table "comment_like" drop constraint "comment_like_comment_id_foreign";`)

    this.addSql(`drop table if exists "admin_user" cascade;`)

    this.addSql(`drop table if exists "comment" cascade;`)

    this.addSql(`drop table if exists "comment_like" cascade;`)

    this.addSql(`drop table if exists "refresh_token" cascade;`)
  }
}
