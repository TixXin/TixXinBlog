import { Migration } from '@mikro-orm/migrations'

export class Migration20261017203535_add_media_reference_indexes extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create index "media_reference_source_key_index" on "media_reference" ("source_key");`)
    this.addSql(`create index "media_reference_post_id_index" on "media_reference" ("post_id");`)
    this.addSql(`create index "media_reference_flash_note_id_index" on "media_reference" ("flash_note_id");`)
    this.addSql(`create index "media_reference_comment_id_index" on "media_reference" ("comment_id");`)
    this.addSql(`create index "media_reference_flash_comment_id_index" on "media_reference" ("flash_comment_id");`)
    this.addSql(`create index "media_reference_moment_id_index" on "media_reference" ("moment_id");`)
    this.addSql(`create index "media_reference_moment_comment_id_index" on "media_reference" ("moment_comment_id");`)
    this.addSql(
      `create index "media_reference_guestbook_message_id_index" on "media_reference" ("guestbook_message_id");`,
    )
    this.addSql(`create index "media_reference_gallery_photo_id_index" on "media_reference" ("gallery_photo_id");`)
    this.addSql(`create index "media_reference_project_id_index" on "media_reference" ("project_id");`)
    this.addSql(`create index "media_reference_subscription_id_index" on "media_reference" ("subscription_id");`)
    this.addSql(`create index "media_reference_friend_link_id_index" on "media_reference" ("friend_link_id");`)
    this.addSql(`create index "media_reference_image_prompt_id_index" on "media_reference" ("image_prompt_id");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index "media_reference_source_key_index";`)
    this.addSql(`drop index "media_reference_post_id_index";`)
    this.addSql(`drop index "media_reference_flash_note_id_index";`)
    this.addSql(`drop index "media_reference_comment_id_index";`)
    this.addSql(`drop index "media_reference_flash_comment_id_index";`)
    this.addSql(`drop index "media_reference_moment_id_index";`)
    this.addSql(`drop index "media_reference_moment_comment_id_index";`)
    this.addSql(`drop index "media_reference_guestbook_message_id_index";`)
    this.addSql(`drop index "media_reference_gallery_photo_id_index";`)
    this.addSql(`drop index "media_reference_project_id_index";`)
    this.addSql(`drop index "media_reference_subscription_id_index";`)
    this.addSql(`drop index "media_reference_friend_link_id_index";`)
    this.addSql(`drop index "media_reference_image_prompt_id_index";`)
  }
}
