<!-- @file settings.vue @description 图库器材资料维护，不由作品统计或上传文件推测设备 -->
<template>
  <section class="gallery-settings">
    <h1>摄影器材设置</h1>
    <NuxtLink to="/admin/gallery">返回图库管理</NuxtLink>
    <p>以下是博主维护的器材介绍。照片数量、地点和分类由公开作品实时统计。未填写的器材不会自动生成。</p>
    <ClientOnly
      ><CommonRequestFeedback
        v-if="pending || error"
        :pending="pending"
        :title="error || '正在读取器材资料'"
        :compact="!!draft"
        @retry="load"
      />
      <p v-if="notice" role="status">{{ notice }}</p>
      <section v-if="recovery" aria-label="器材恢复副本">
        <p>发现本标签页未保存的器材资料。</p>
        <button type="button" :disabled="pending || !ready" @click="restore">恢复器材输入</button>
      </section>
      <section v-if="previousRecoveries.length" aria-label="其他内容库的器材副本">
        <h2>其他内容库中尚未保存的器材资料</h2>
        <p>这些副本已单独保留，不会覆盖当前设置。请先核对当前服务器资料，再将需要的文字手动填入表单。</p>
        <GalleryGearCard v-for="item in previousRecoveries" :key="item.key" :gear="item.gear" />
      </section>
      <form v-if="draft" @submit.prevent="save">
        <fieldset :disabled="pending || !ready">
          <legend>器材列表（最多 12 项）</legend>
          <div v-for="(item, index) in draft.gear" :key="index" class="gallery-settings__item">
            <label
              >器材名称<input
                v-model="item.name"
                :aria-label="`器材名称 ${index + 1}`"
                required
                maxlength="80" /></label
            ><label
              >器材介绍<textarea
                v-model="item.description"
                :aria-label="`器材介绍 ${index + 1}`"
                maxlength="300"
                rows="2"
              /></label
            ><label
              >器材图标<select v-model="item.icon">
                <option value="lucide:camera">相机</option>
                <option value="lucide:circle">镜头</option>
                <option value="lucide:smartphone">手机</option>
              </select></label
            ><button type="button" :aria-label="`移除器材 ${index + 1}`" @click="draft.gear.splice(index, 1)">
              移除器材
            </button>
          </div>
          <button
            type="button"
            :disabled="draft.gear.length >= 12"
            @click="draft.gear.push({ name: '', description: '', icon: 'lucide:camera' })"
          >
            添加器材
          </button>
        </fieldset>
        <button type="submit" :disabled="pending || !ready || !dirty">保存器材资料</button>
        <p>服务器版本 {{ draft.revision }}{{ dirty ? ' · 有未保存输入' : '' }}</p>
      </form>
      <section v-if="conflict" aria-label="器材版本冲突">
        <h2>器材资料已被修改</h2>
        <GalleryGearCard :gear="conflict.gear" /><button type="button" :disabled="pending" @click="merge">
          保留输入，按最新版本继续合并
        </button>
      </section>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin' })
useSeoMeta({ title: '摄影器材设置', robots: 'noindex, nofollow' })
const {
  draft,
  conflict,
  recovery,
  previousRecoveries,
  pending,
  ready,
  error,
  notice,
  dirty,
  load,
  save,
  restore,
  merge,
} = useGallerySettingsEditor()
</script>
<style scoped lang="scss">
.gallery-settings {
  max-width: 850px;
  display: grid;
  gap: 1rem;
  overflow-wrap: anywhere;
}
h1 {
  font-size: 1.5rem;
  font-weight: 700;
}
a {
  color: var(--accent);
}
p {
  color: var(--text-muted);
}
fieldset {
  min-width: 0;
  border: 1px solid var(--border);
  padding: 1rem;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}
label {
  display: grid;
  gap: 0.5rem;
  margin-block: 0.5rem;
}
input,
textarea,
select,
button {
  max-width: 100%;
  min-width: 0;
  min-height: 44px;
  color: var(--text-main);
  background: var(--surface-2);
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}
button:disabled {
  opacity: 0.5;
}
.gallery-settings__item {
  border-bottom: 1px solid var(--border);
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}
</style>
