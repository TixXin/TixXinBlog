/** @file useAdminPostListQuery.ts @description 后台文章列表的筛选表单、路由查询同步与翻页排序跳转 */
import type { Ref } from 'vue'
import type { AdminPostAppliedQuery, AdminPostListForm } from './adminListQuery'
import {
  appliedPageQuery,
  filterNavigationQuery,
  normalizeAdminPostOrder,
  normalizeAdminPostSort,
  parseAdminPostListQuery,
} from './adminListQuery'

const LIST_PATH = '/admin/posts'

export interface AdminPostListQueryHooks {
  /** 筛选条件变化：回填表单后清空选择 */
  onCriteriaChange: () => void
  /** 只翻页或改排序：取消进行中的全选 */
  onSameCriteria: () => void
  /** 目标地址与当前一致时直接重新读取 */
  reload: () => Promise<void>
}

const EMPTY_FORM: AdminPostListForm = { search: '', status: '', category: '', folder: '', tag: '' }

/** 筛选表单的响应式字段，按表单顺序整体读写 */
function createListForm() {
  const fields = { search: ref(''), status: ref(''), category: ref(''), folder: ref(''), tag: ref('') }
  const keys = Object.keys(fields) as (keyof AdminPostListForm)[]
  return {
    fields,
    values: () => Object.fromEntries(keys.map((key) => [key, fields[key].value])) as unknown as AdminPostListForm,
    assign: (form: AdminPostListForm) => keys.forEach((key) => (fields[key].value = form[key])),
  }
}

type ListForm = ReturnType<typeof createListForm>
interface ListQueryState {
  form: ListForm
  sort: Ref<string>
  order: Ref<string>
  page: Ref<number>
  pageQuery: (page: number) => Record<string, string>
}

/** 提交筛选、翻页、改排序、清空与越界改写的路由跳转 */
function createListNavigation(state: ListQueryState, reload: () => Promise<void>) {
  const { form, sort, order, page, pageQuery } = state
  const route = useRoute(),
    router = useRouter()
  const isCurrent = (query: Record<string, string>) =>
    router.resolve({ path: LIST_PATH, query }).fullPath === route.fullPath

  async function navigate(pageNumber: number) {
    const query = filterNavigationQuery(form.values(), sort.value, order.value, pageNumber)
    if (isCurrent(query)) await reload()
    else await router.push({ path: LIST_PATH, query })
  }
  // 翻页只改变已应用查询的页码，搜索框中的未提交输入不隐式变成筛选。
  function pushPage(value: number) {
    if (value !== page.value) void router.push({ path: LIST_PATH, query: pageQuery(value) })
  }
  function applyOrdering(kind: 'sort' | 'order', value: string) {
    if (kind === 'sort') sort.value = normalizeAdminPostSort(value)
    else order.value = normalizeAdminPostOrder(value)
    // 排序回到第一页，但仍使用已应用的筛选，不把搜索框草稿提交出去。
    const query = { ...pageQuery(1), sort: sort.value, order: order.value }
    if (!isCurrent(query)) void router.push({ path: LIST_PATH, query })
  }
  function clearFilters() {
    form.assign(EMPTY_FORM)
    sort.value = 'updatedAt'
    order.value = 'desc'
    void navigate(1)
  }
  const replacePage = (value: number) => router.replace({ path: LIST_PATH, query: pageQuery(value) })
  return { navigate, pushPage, applyOrdering, clearFilters, replacePage }
}

export function useAdminPostListQuery(hooks: AdminPostListQueryHooks) {
  const route = useRoute()
  const form = createListForm()
  const sort = ref('updatedAt'),
    order = ref('desc'),
    page = ref(1)
  let applied: AdminPostAppliedQuery = {},
    filterKey = ''
  const pageQuery = (value: number) => appliedPageQuery(applied, value)

  function sync() {
    const parsed = parseAdminPostListQuery(route.query)
    // 只翻页或改排序时保留搜索框草稿；筛选条件本身变化才回填表单并清空选择。
    if (parsed.criteriaKey !== filterKey) {
      form.assign(parsed.form)
      hooks.onCriteriaChange()
    } else hooks.onSameCriteria()
    sort.value = parsed.sort
    order.value = parsed.order
    page.value = parsed.page
    filterKey = parsed.criteriaKey
    applied = parsed.applied
  }
  const navigation = createListNavigation({ form, sort, order, page, pageQuery }, hooks.reload)
  const currentApplied = () => applied
  return { ...form.fields, sort, order, page, sync, currentApplied, ...navigation }
}
