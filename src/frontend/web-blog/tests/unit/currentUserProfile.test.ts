/** @file currentUserProfile.test.ts @description 博主登录后的展示名与头像取站点资料，资料变更即时生效，缺省时回退登录名与默认头像 */
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { useCurrentUser } from '../../app/composables/useCurrentUser'
import { useSiteSettings } from '../../app/composables/useSiteSettings'

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }))
mockNuxtImport('$fetch', () => mocks.fetch)
const wrappers: { unmount(): void }[] = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  mocks.fetch.mockReset()
  vi.unstubAllGlobals()
})

async function setup() {
  let auth!: ReturnType<typeof useCurrentUser>
  let site!: ReturnType<typeof useSiteSettings>
  wrappers.push(
    await mountSuspended(
      defineComponent({
        setup() {
          auth = useCurrentUser()
          site = useSiteSettings()
          auth.currentUser.value = null
          auth.accessToken.value = null
          return () => h('div')
        },
      }),
    ),
  )
  vi.stubGlobal('$fetch', mocks.fetch)
  return { auth, site }
}

it('登录后展示名与头像取站点资料，后台修改资料后即时更新', async () => {
  const { auth, site } = await setup()
  site.settings.value = { ...site.settings.value, ownerName: 'TixXin', avatar: '/api/v1/media/owner.webp' }
  mocks.fetch.mockResolvedValueOnce({
    data: { accessToken: 'token', expiresIn: 900, user: { id: 'u1', username: 'tixxin' } },
  })
  await auth.login('tixxin', 'password')
  expect(auth.currentUser.value).toMatchObject({
    id: 'u1',
    nickname: 'TixXin',
    avatar: '/api/v1/media/owner.webp',
    role: 'owner',
  })
  site.settings.value = { ...site.settings.value, avatar: '/api/v1/media/new.webp' }
  expect(auth.currentUser.value?.avatar).toBe('/api/v1/media/new.webp')
})

it('站点资料缺少名称与头像时回退到登录名与默认头像；退出后为匿名', async () => {
  const { auth, site } = await setup()
  site.settings.value = { ...site.settings.value, ownerName: ' ', avatar: '' }
  mocks.fetch.mockResolvedValueOnce({
    data: { accessToken: 'token', expiresIn: 900, user: { id: 'u1', username: 'tixxin' } },
  })
  await auth.login('tixxin', 'password')
  expect(auth.currentUser.value).toMatchObject({ nickname: 'tixxin', avatar: '/avatar.svg' })
  auth.currentUser.value = null
  expect(auth.currentUser.value).toBeNull()
  expect(auth.isLoggedIn.value).toBe(false)
})
