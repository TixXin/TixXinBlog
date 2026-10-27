<!-- @file MomentFormLinkFields.vue @description 动态编辑表单的引用区块：在不引用、站内文章与外链卡片之间切换，切换时清除互斥字段 -->
<template>
  <label
    >{{ $t('admin-content.momentForm.linkType')
    }}<select
      :value="value.linkedLink ? 'link' : value.linkedArticleId ? 'article' : linkMode"
      :aria-label="$t('admin-content.momentForm.linkTypeAria')"
      @change="setLinkMode(($event.target as HTMLSelectElement).value)"
    >
      <option value="none">{{ $t('admin-content.momentForm.linkNone') }}</option>
      <option value="article">{{ $t('admin-content.momentForm.linkArticle') }}</option>
      <option value="link">{{ $t('admin-content.momentForm.linkExternal') }}</option>
    </select></label
  >
  <section v-if="linkMode === 'article' || value.linkedArticleId">
    <label
      >{{ $t('admin-content.momentForm.articleSearch')
      }}<input
        v-model="articleSearch"
        type="search"
        :aria-label="$t('admin-content.momentForm.articleSearchAria')"
        maxlength="200"
        :placeholder="$t('admin-content.momentForm.articleSearchPlaceholder')"
        @input="emit('search-articles', articleSearch)"
    /></label>
    <p v-if="articlesPending" role="status">{{ $t('admin-content.momentForm.articleSearching') }}</p>
    <p v-if="articlesError" role="alert">{{ articlesError }}</p>
    <label
      >{{ $t('admin-content.momentForm.article')
      }}<select
        :value="value.linkedArticleId ?? ''"
        :aria-label="$t('admin-content.momentForm.article')"
        @change="
          emit('change', {
            linkedArticleId: ($event.target as HTMLSelectElement).value
              ? Number(($event.target as HTMLSelectElement).value)
              : null,
          })
        "
      >
        <option value="">{{ $t('admin-content.momentForm.articlePlaceholder') }}</option>
        <option v-for="post in articleChoices" :key="post.id" :value="post.id">{{ post.title }}</option>
      </select></label
    >
  </section>
  <div v-if="value.linkedLink" class="moment-editor__row">
    <label
      >{{ $t('admin-content.momentForm.linkUrl')
      }}<input
        :value="value.linkedLink.url"
        type="url"
        maxlength="2048"
        :aria-label="$t('admin-content.momentForm.linkUrlAria')"
        @input="changeLink({ url: ($event.target as HTMLInputElement).value })"
    /></label>
    <label
      >{{ $t('admin-content.momentForm.linkTitle')
      }}<input
        :value="value.linkedLink.title"
        maxlength="160"
        :aria-label="$t('admin-content.momentForm.linkTitleAria')"
        @input="changeLink({ title: ($event.target as HTMLInputElement).value })"
    /></label>
    <label
      >{{ $t('admin-content.momentForm.linkDescription')
      }}<input
        :value="value.linkedLink.description"
        maxlength="500"
        @input="changeLink({ description: ($event.target as HTMLInputElement).value })"
    /></label>
    <label
      >{{ $t('admin-content.momentForm.linkSiteName')
      }}<input
        :value="value.linkedLink.siteName"
        maxlength="80"
        @input="changeLink({ siteName: ($event.target as HTMLInputElement).value })"
    /></label>
    <label
      >{{ $t('admin-content.momentForm.linkImage')
      }}<input
        :value="value.linkedLink.image"
        maxlength="2048"
        @input="changeLink({ image: ($event.target as HTMLInputElement).value })"
    /></label>
    <label
      >{{ $t('admin-content.momentForm.linkFavicon')
      }}<input
        :value="value.linkedLink.favicon"
        maxlength="2048"
        @input="changeLink({ favicon: ($event.target as HTMLInputElement).value })"
    /></label>
  </div>
</template>
<script setup lang="ts">
import type { MomentEditable, MomentLinkedLink } from '~/features/moment/types'

const props = defineProps<{
  value: MomentEditable
  articleChoices: { id: number; title: string }[]
  articlesPending: boolean
  articlesError: string
}>()
const emit = defineEmits<{ change: [value: Partial<MomentEditable>]; 'search-articles': [query: string] }>()
const linkMode = ref('none'),
  articleSearch = ref('')
function changeLink(value: Partial<MomentLinkedLink>) {
  emit('change', { linkedLink: { url: '', title: '', ...props.value.linkedLink, ...value } })
}
function setLinkMode(value: string) {
  linkMode.value = value
  emit('change', { linkedArticleId: null, linkedLink: value === 'link' ? { url: '', title: '' } : null })
  if (value === 'article') emit('search-articles', '')
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/moment-editor' as moment;

@include moment.form;
</style>
