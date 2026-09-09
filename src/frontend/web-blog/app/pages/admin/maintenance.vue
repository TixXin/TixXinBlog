<!--
  @file maintenance.vue
  @description 内容包下载和安全迁入，明确媒体范围、冲突策略与持久化操作结果。
-->
<template>
  <section class="maintenance">
    <h1>备份与维护</h1>
    <ClientOnly>
      <section aria-label="运行诊断">
        <h2>运行诊断</h2>
        <p>读取真实服务、迁移和存储状态。存储探测不代表全部媒体文件完整，文件完整性可单独核验。</p>
        <button type="button" :disabled="diagnostics.pending.value" @click="diagnostics.load">刷新运行诊断</button
        ><button type="button" :disabled="diagnostics.pending.value" @click="diagnostics.checkMedia">
          核验现有媒体文件
        </button>
        <p v-if="diagnostics.pending.value" role="status">正在检查…</p>
        <p v-if="diagnostics.error.value" role="alert">{{ diagnostics.error.value }}</p>
        <ul v-if="diagnostics.data.value">
          <li>数据库连接：{{ diagnostics.data.value.databaseReachable ? '可用' : '不可用' }}</li>
          <li>
            待应用迁移 {{ diagnostics.data.value.pendingMigrations }} 个 ·
            {{ diagnostics.data.value.schemaDrift ? '结构与代码不一致' : '结构与代码一致' }}
          </li>
          <li>
            媒体存储：{{
              diagnostics.data.value.storage.readable &&
              diagnostics.data.value.storage.writable &&
              diagnostics.data.value.storage.cleaned
                ? '读写与清理探测通过'
                : '探测存在问题'
            }}
            · {{ diagnostics.data.value.mediaRecords }} 个登记资源
          </li>
          <li>
            运行环境 {{ diagnostics.data.value.runtime.environment }} · Node {{ diagnostics.data.value.runtime.node
            }}{{ diagnostics.data.value.runtime.nodeSupported ? '' : '（版本不受支持）' }}
          </li>
        </ul>
        <template v-if="diagnostics.media.value"
          ><p role="status">
            已核验 {{ diagnostics.media.value.checked }} 个媒体文件，发现
            {{ diagnostics.media.value.problems.length }} 项问题。
          </p>
          <ul>
            <li v-for="item in diagnostics.media.value.problems" :key="item.id">
              <NuxtLink :to="`/admin/media?search=${item.id}&deleted=${item.deleted}`">{{ item.id }}</NuxtLink> ·
              {{ item.reason }}
            </li>
          </ul></template
        >
      </section>
      <section aria-label="完整备份与恢复">
        <h2>完整备份与恢复</h2>
        <p>
          完整备份保存数据库、历史修订、账号记录和全部受管媒体，生成一致快照及校验清单。恢复命令新建无外部网络的容器，不覆盖当前站点。
        </p>
        <p>在项目终端生成完整备份：</p>
        <pre><code>corepack pnpm --filter server-main run backup:full</code></pre>
        <p>校验与隔离恢复使用生成的备份目录：</p>
        <pre><code>corepack pnpm --filter server-main run backup:verify --directory &lt;备份目录&gt;
corepack pnpm --filter server-main run backup:restore --directory &lt;备份目录&gt;</code></pre>
        <p>
          恢复后会撤销备份中的登录授权，并要求旧页面刷新后再修改数据。连接配置保存在恢复目录，应用连接不会自动切换。完整步骤见项目文档
          docs/backup-and-recovery.md。
        </p>
      </section>
      <section aria-label="导出内容包">
        <h2>导出内容包</h2>
        <p>
          用于迁入文章、闪念、朋友圈、评论、留言、目录和当前站点资料。文章类内容迁入为草稿；留言迁入为待审，隐藏和删除状态保留。
        </p>
        <p>
          内容包不包含账号、登录凭据、访客控制标识、点赞、回应、历史修订和互动去重记录；完整数据库与媒体恢复使用维护流程。
        </p>
        <label><input v-model="mediaIncluded" type="checkbox" :disabled="pending" />包含受管媒体图片文件</label>
        <p>
          {{
            mediaIncluded
              ? '文件内包含受管图片字节；外链图片仍使用原地址。'
              : '仅包含媒体清单；迁入时需已有可用资源或另行恢复图片文件。'
          }}
        </p>
        <button type="button" :disabled="pending" @click="exportPackage">下载内容包</button>
      </section>
      <section aria-label="选择内容包">
        <h2>迁入内容</h2>
        <p>
          支持本项目生成的 v1、v2、v3 JSON 内容包，最多 50MB。v2 增加朋友圈，v3
          增加留言和回复关系；先校验格式、图片和引用，再确认导入。
        </p>
        <p>留言迁入后不会自动公开或置顶。已删除留言保留为不可见的引用记录，审核前请核对内容与作者。</p>
        <label
          >选择内容包<input type="file" accept="application/json,.json" :disabled="pending" @change="chooseFile"
        /></label>
        <p v-if="file">已选 {{ file.name }} · {{ (file.size / 1024).toFixed(1) }}KB</p>
        <label
          >重复内容策略<select v-model="strategy" :disabled="pending">
            <option value="skip">跳过完全相同内容及其评论</option>
            <option value="copy">为全部内容创建新草稿副本</option>
          </select></label
        >
        <label
          ><input v-model="includeSettings" type="checkbox" :disabled="pending" />同时迁入站点资料和评论审核设置</label
        >
        <p>
          相同内容判定不比较发布状态和互动数。目录遵循本站历史名称规则。新副本重新累计浏览和点赞，正文中的链接保留原文，发布前请核对。
        </p>
        <button type="button" :disabled="pending || !file" @click="preview">生成导入预览</button
        ><button v-if="requestId" type="button" :disabled="pending" @click="read(requestId)">查询本次上传票据</button>
      </section>
      <p v-if="pending" role="status">正在处理，请等待服务器结果…</p>
      <p v-if="error" role="alert">{{ error }}</p>
      <section v-if="job" aria-label="内容导入预览">
        <h2>{{ job.completed ? '导入结果' : '导入预览' }}</h2>
        <p>
          票据 {{ job.ticket }} · {{ job.strategy === 'skip' ? '跳过相同内容' : '创建全部新副本' }} ·
          {{ job.includeSettings ? '包含站点资料与审核设置' : '保留当前站点设置' }}
        </p>
        <p>
          计划新建 {{ job.plan.counts.posts }} 篇文章草稿、{{ job.plan.counts.flashes }} 条闪念草稿、{{
            job.plan.counts.moments ?? 0
          }}
          条朋友圈草稿，迁入 {{ job.plan.counts.comments }} 条评论；跳过 {{ job.plan.counts.skipped }} 项相同内容。
        </p>
        <p>迁入 {{ job.plan.counts.guestbook ?? 0 }} 条留言及其回复关系，按预览保留为待审、隐藏或已删除状态。</p>
        <p>新增 {{ job.plan.counts.media }} 个媒体记录，写入或修复 {{ job.plan.counts.files }} 个图片文件。</p>
        <p v-if="job.error" role="alert">{{ job.error }}</p>
        <p v-if="job.expired">预览已过期，请重新选择文件生成票据。</p>
        <ul>
          <li v-for="issue in job.plan.errors" :key="issue">{{ issue }}</li>
        </ul>
        <details>
          <summary>查看文章、闪念、朋友圈与留言清单</summary>
          <ul>
            <li v-for="post in job.plan.posts" :key="`post-${post.sourceId}`">
              {{ post.title }} · {{ post.reason }}{{ post.slug ? ` · 地址标识 ${post.slug}` : '' }}
            </li>
            <li v-for="flash in job.plan.flashes" :key="flash.sourceId">{{ flash.title }} · {{ flash.reason }}</li>
            <li v-for="moment in job.plan.moments ?? []" :key="`moment-${moment.sourceId}`">
              {{ moment.title }} · {{ moment.reason }}
            </li>
            <li v-for="message in job.plan.guestbook ?? []" :key="`guestbook-${message.sourceId}`">
              {{ message.title }} · {{ message.reason }}
            </li>
          </ul>
        </details>
        <AdminSiteSettingsPreview
          v-if="job.settingsPreview && !job.completed"
          :value="job.settingsPreview"
          label="将写入的站点资料"
        />
        <template v-if="job.result">
          <p role="status">
            已创建 {{ job.result.posts.length }} 篇文章草稿、{{ job.result.flashes.length }} 条闪念草稿、{{
              job.result.moments?.length ?? 0
            }}
            条朋友圈草稿，迁入 {{ job.result.comments }} 条评论。
          </p>
          <p>已迁入 {{ job.result.guestbook?.length ?? 0 }} 条非公开留言，回复关系已重建。</p>
          <ul>
            <li v-for="post in job.result.posts" :key="post.id">
              <NuxtLink :to="`/admin/posts/${post.id}`">检查新文章草稿 #{{ post.id }}</NuxtLink
              >（来源 #{{ post.sourceId }}）
            </li>
          </ul>
          <NuxtLink v-if="job.result.flashes.length" to="/admin/flashes?status=draft">检查闪念草稿</NuxtLink>
          <NuxtLink v-if="job.result.moments?.length" to="/admin/moments?status=draft">检查朋友圈草稿</NuxtLink>
          <NuxtLink v-if="job.result.guestbook?.length" to="/admin/guestbook">检查迁入留言</NuxtLink>
        </template>
        <template v-if="!job.completed && !job.expired">
          <p>
            预览到期：{{
              new Date(job.expiresAt).toLocaleString('zh-CN', { hour12: false })
            }}。执行时重新校验目标变化，数据库变更统一提交；未能确认结果时请查询同一票据。
          </p>
          <label
            >输入“导入为新草稿”确认<input v-model="acknowledgement" :disabled="pending" autocomplete="off"
          /></label>
          <button
            type="button"
            :disabled="pending || !job.plan.ready || acknowledgement !== '导入为新草稿'"
            @click="execute"
          >
            确认导入预览内容</button
          ><button type="button" :disabled="pending" @click="repreview">重新生成此票据的预览</button>
        </template>
        <button type="button" :disabled="pending" @click="read()">查询导入结果</button>
      </section>
      <section aria-label="最近导入记录">
        <h2>最近导入记录</h2>
        <p v-if="recentError" role="alert">
          {{ recentError }} <button type="button" @click="loadRecent">重试记录</button>
        </p>
        <p v-else-if="!recent.length">暂无导入记录</p>
        <ul>
          <li v-for="item in recent" :key="item.ticket">
            <button type="button" :disabled="pending" @click="read(item.ticket)">
              {{ new Date(item.createdAt).toLocaleString('zh-CN', { hour12: false }) }} ·
              {{ item.completed ? '已完成' : item.expired ? '已过期' : '预览或执行中' }}
            </button>
          </li>
        </ul>
      </section>
    </ClientOnly>
  </section>
</template>
<script setup lang="ts">
definePageMeta({ layout: 'admin', key: '/admin/maintenance' })
useSeoMeta({ title: '备份与维护', robots: 'noindex, nofollow' })
const {
  pending,
  error,
  mediaIncluded,
  file,
  strategy,
  includeSettings,
  requestId,
  job,
  acknowledgement,
  recent,
  recentError,
  exportPackage,
  choose,
  preview,
  read,
  repreview,
  execute,
  loadRecent,
} = useContentBackup()
const diagnostics = useMaintenanceDiagnostics()
function chooseFile(event: Event) {
  choose((event.target as HTMLInputElement).files?.[0] ?? null)
}
</script>
<style scoped>
pre {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  padding: 0.75rem;
  background: var(--surface-2);
  border-radius: 0.5rem;
  font-size: 0.8rem;
}
.maintenance {
  overflow-wrap: anywhere;
}
h1 {
  font-size: 1.6rem;
}
h2 {
  font-size: 1.2rem;
  margin-bottom: 0.75rem;
}
section {
  padding: 1rem;
  margin-block: 1rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
}
label {
  display: block;
  margin-block: 0.8rem;
}
p {
  margin-block: 0.65rem;
  color: var(--text-muted);
}
input,
select,
button {
  max-width: 100%;
  padding: 0.6rem;
  background: var(--surface-2);
  color: var(--text-main);
  border: 1px solid var(--border);
  border-radius: 0.4rem;
}
button {
  margin: 0.4rem 0.5rem 0.4rem 0;
}
button:disabled {
  opacity: 0.5;
}
a {
  color: var(--accent);
}
ul {
  padding-left: 1.2rem;
}
details {
  margin-block: 1rem;
}
summary {
  cursor: pointer;
}
</style>
