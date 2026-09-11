<!--
  @file site.vue
  @description 站点公开资料编辑、预览、失败保留和历史恢复。
-->
<template>
  <section class="admin-site">
    <h1>站点设置</h1>
    <p>以下资料会公开展示。保存后无需重启，刷新前台即可读取新版本。</p>
    <p>站点地址：{{ siteUrl }}。地址、监听端口和存储目录由部署环境配置，修改后需要重启对应服务。</p>
    <p v-if="pending" role="status">正在处理站点设置…</p>
    <p v-if="error" role="alert">
      {{ error }} <button v-if="!draft" type="button" :disabled="pending" @click="load">重试读取</button>
    </p>
    <ClientOnly>
      <template v-if="draft">
        <p v-if="submission" role="status">
          此前提交结果尚未确认。
          <button type="button" :disabled="pending || !ready" @click="checkSubmission">核对服务器提交结果</button>
        </p>
        <p>
          服务器版本 {{ draft.revision }} · 保存于
          {{ new Date(draft.updatedAt).toLocaleString('zh-CN', { hour12: false }) }}{{ dirty ? ' · 有未保存输入' : '' }}
        </p>
        <form @submit.prevent="save">
          <fieldset :disabled="pending || !ready">
            <legend>站点和博主资料</legend>
            <label>站点名称<input v-model="draft.name" maxlength="80" required /></label>
            <label>站点简介<textarea v-model="draft.description" maxlength="300" rows="3" /></label>
            <label>博主名称<input v-model="draft.ownerName" maxlength="80" required /></label>
            <label>博主简介<input v-model="draft.ownerTitle" maxlength="200" /></label>
            <label>头像地址<input v-model="draft.avatar" maxlength="1000" /></label>
            <button type="button" @click="pickerOpen = true">从媒体库选择头像</button>
            <label>头像替代文本<input v-model="draft.avatarAlt" maxlength="300" /></label>
          </fieldset>
          <fieldset :disabled="pending || !ready">
            <legend>社交链接（最多 8 个）</legend>
            <div v-for="(link, index) in draft.socials" :key="index" class="admin-site__social">
              <label>链接名称<input v-model="link.label" maxlength="40" required /></label>
              <label
                >链接地址<input v-model="link.href" maxlength="1000" placeholder="https:// 或 mailto:" required
              /></label>
              <label
                >链接图标<select v-model="link.icon">
                  <option v-for="icon in siteSocialIcons" :key="icon" :value="icon">
                    {{ icon.replace('lucide:', '') }}
                  </option>
                </select></label
              >
              <button type="button" :aria-label="`移除社交链接 ${index + 1}`" @click="draft.socials.splice(index, 1)">
                移除
              </button>
            </div>
            <button
              type="button"
              :disabled="draft.socials.length >= 8"
              @click="draft.socials.push({ label: '', href: '', icon: 'lucide:globe' })"
            >
              添加社交链接
            </button>
          </fieldset>
          <fieldset :disabled="pending || !ready">
            <legend>公告与默认 SEO</legend>
            <label
              >站点公告<textarea
                v-model="draft.announcement"
                maxlength="1000"
                rows="4"
                placeholder="留空则不展示公告"
              />
            </label>
            <label
              >首页 SEO 标题<input v-model="draft.seoTitle" maxlength="160" placeholder="留空使用站点名称"
            /></label>
            <label
              >默认 SEO 描述<textarea
                v-model="draft.seoDescription"
                maxlength="320"
                rows="3"
                placeholder="文章自定义 SEO 优先于站点默认值"
              />
            </label>
          </fieldset>
          <AdminAboutSettingsFields v-if="draft.about" v-model="draft.about" :disabled="pending || !ready" />
          <AdminSiteSettingsPreview :value="draft" label="保存后的公开资料预览" />
          <AdminActionBar
            ><button type="submit" :disabled="pending || !ready || !dirty || !!submission || !!conflict">
              {{ pending ? '处理中…' : '保存并生效' }}
            </button></AdminActionBar
          >
        </form>
        <section v-if="conflict" aria-label="站点配置冲突">
          <AdminSiteSettingsPreview :value="conflict" label="最新服务器资料" /><button
            type="button"
            :disabled="pending || !ready || !!submission"
            @click="mergeConflict"
          >
            保留输入，按最新版本继续合并
          </button>
        </section>
        <p v-if="preserved">
          此前未保存输入仍保留在本页。<button
            type="button"
            :disabled="pending || !ready || !!submission"
            @click="recoverPreserved"
          >
            恢复此前输入
          </button>
        </p>
        <section class="admin-site__history" aria-label="站点配置历史">
          <h2>配置历史</h2>
          <p>历史版本保留头像引用，可比较后载入编辑，或明确恢复为新服务器版本。</p>
          <p v-if="historyError" role="alert">
            {{ historyError }} <button type="button" :disabled="historyPending" @click="loadHistory()">重试历史</button>
          </p>
          <ul>
            <li v-for="item in history" :key="item.revision">
              <button type="button" :disabled="historyPending || pending" @click="inspect(item.revision)">
                查看版本 {{ item.revision }} · {{ item.reason }} ·
                {{ new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false }) }}
              </button>
            </li>
          </ul>
          <button type="button" :disabled="historyPending || historyPage <= 1" @click="loadHistory(historyPage - 1)">
            上一页历史</button
          ><span> {{ historyPage }} / {{ Math.max(1, Math.ceil(historyTotal / 20)) }} </span
          ><button
            type="button"
            :disabled="historyPending || historyPage * 20 >= historyTotal"
            @click="loadHistory(historyPage + 1)"
          >
            下一页历史
          </button>
          <template v-if="historical"
            ><AdminSiteSettingsPreview :value="historical" :label="`历史版本 ${historical.revision} 预览`" /><button
              type="button"
              :disabled="pending || !ready || !!submission"
              @click="loadHistorical"
            >
              载入历史资料编辑</button
            ><button type="button" :disabled="pending || !ready || !!submission" @click="restoreHistorical">
              恢复此版本到服务器
            </button></template
          >
        </section>
        <AdminMediaPicker v-model:open="pickerOpen" @selected="selectAvatar" />
      </template>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
import { siteSocialIcons } from '~/features/site/settings'
import type { MediaAsset } from '~/features/media/types'
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '站点设置', robots: 'noindex, nofollow' })
const siteUrl = useRuntimeConfig().public.siteUrl
const {
  draft,
  ready,
  conflict,
  historical,
  preserved,
  submission,
  checkSubmission,
  pending,
  error,
  dirty,
  history,
  historyPage,
  historyTotal,
  historyPending,
  historyError,
  load,
  save,
  loadHistory,
  inspect,
  loadHistorical,
  restoreHistorical,
  mergeConflict,
  recoverPreserved,
} = useSiteSettingsEditor()
const pickerOpen = ref(false)
function selectAvatar(asset: MediaAsset) {
  if (draft.value) {
    draft.value.avatar = asset.url
    draft.value.avatarAlt = asset.alt
  }
}
</script>
<style scoped lang="scss">
.admin-site {
  overflow-wrap: anywhere;
}
h1 {
  font-size: 1.6rem;
}
h2 {
  font-size: 1.2rem;
}
p {
  margin-block: 0.75rem;
  color: var(--text-muted);
}
fieldset {
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1rem;
  margin-block: 1rem;
  min-width: 0;
}
legend {
  padding-inline: 0.5rem;
}
label {
  display: grid;
  gap: 0.5rem;
  margin-block: 0.75rem;
}
input,
textarea,
select,
button {
  background: var(--surface-2);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  padding: 0.65rem;
  max-width: 100%;
}
button {
  margin: 0.4rem 0.5rem 0.4rem 0;
}
button:disabled {
  opacity: 0.5;
}
.admin-site__social {
  padding: 0.75rem;
  border-bottom: 1px solid var(--border);
}
.admin-site__history {
  margin-block: 2rem;
}
ul {
  padding: 0;
  list-style: none;
}
</style>
