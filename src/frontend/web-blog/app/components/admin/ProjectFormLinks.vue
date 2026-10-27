<!-- @file ProjectFormLinks.vue @description 项目编辑表单的链接区块：每种用途至多一条，新增时取第一个未使用的用途，最多 4 项 -->
<template>
  <section :aria-label="$t('admin-media.projectForm.linksLabel')">
    <h2>{{ $t('admin-media.projectForm.linksTitle', { count: links.length, max: 4 }) }}</h2>
    <div v-for="(link, index) in links" :key="index" class="project-editor__row">
      <label
        >{{ $t('admin-media.projectForm.linkKind')
        }}<select
          :value="link.kind"
          :aria-label="$t('admin-media.projectForm.linkKindLabel', { index: index + 1 })"
          @change="changeLink(index, { kind: ($event.target as HTMLSelectElement).value as ProjectLinkKind })"
        >
          <option
            v-for="kind in projectLinkKinds"
            :key="kind"
            :value="kind"
            :disabled="links.some((other, i) => i !== index && other.kind === kind)"
          >
            {{ projectLinkLabel(kind, t) }}
          </option>
        </select></label
      ><label
        >{{ $t('admin-media.projectForm.linkHref')
        }}<input
          :value="link.href"
          :aria-label="$t('admin-media.projectForm.linkHrefLabel', { index: index + 1 })"
          type="url"
          pattern="https?://.+"
          required
          maxlength="2048"
          placeholder="https://"
          @input="changeLink(index, { href: ($event.target as HTMLInputElement).value })" /></label
      ><button
        type="button"
        :aria-label="$t('admin-media.projectForm.removeLinkLabel', { index: index + 1 })"
        @click="
          emit(
            'change',
            links.filter((_, i) => i !== index),
          )
        "
      >
        {{ $t('admin-media.projectForm.removeLink') }}
      </button>
    </div>
    <button type="button" :disabled="links.length >= 4" @click="addLink">
      {{ $t('admin-media.projectForm.addLink') }}
    </button>
    <p v-if="!links.length">{{ $t('admin-media.projectForm.noLinks') }}</p>
  </section>
</template>
<script setup lang="ts">
import { projectLinkLabel, projectLinkLabels } from '~/features/project/types'
import type { ProjectLinkInput, ProjectLinkKind } from '~/features/project/types'

const props = defineProps<{ links: ProjectLinkInput[] }>()
const emit = defineEmits<{ change: [links: ProjectLinkInput[]] }>()
const { t } = useI18n()
const projectLinkKinds = Object.keys(projectLinkLabels) as ProjectLinkKind[]
function changeLink(index: number, patch: Partial<ProjectLinkInput>) {
  emit(
    'change',
    props.links.map((link, i) => (i === index ? { ...link, ...patch } : { ...link })),
  )
}
function addLink() {
  const kind = projectLinkKinds.find((kind) => !props.links.some((link) => link.kind === kind))
  if (kind) emit('change', [...props.links, { kind, href: '' }])
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/project-editor' as project;

@include project.form;
</style>
