# TixXinBlog 后端文档

本目录汇总 TixXinBlog 后端服务（`src/backend/server-main/`）的全部设计文档。前端文档体系保留在 `docs/` 根目录（`project-architecture.md` / `directory-structure.md` 等），后端相关一律放入本目录，避免与前端约定交织。

## 1. 文档定位

后端当前处于 **从零设计阶段**，代码尚未落地。本目录不是"已有系统的说明书"，而是"后续开发者据此可以初始化工程、建模、写接口"的底盘文档。

适用读者：

- **后端开发者**：按 `tech-stack.md` + `development.md` 初始化工程与编码
- **前端对接者**：按 `api.md` 编写 composable，切换 `useMockRepo = false`
- **运维 / 部署**：按 `development.md` 的部署章节起容器栈

## 2. 阅读顺序

建议按下表顺序阅读：

| 顺序 | 文档 | 作用 |
|------|------|------|
| 1 | [requirements.md](./requirements.md) | 需求文档：前端已经呈现的行为 → 后端必须撑住的能力清单 |
| 2 | [tech-stack.md](./tech-stack.md) | 技术栈文档：选型理由、版本、关键依赖清单 |
| 3 | [development.md](./development.md) | 开发文档：项目结构、编码规范、本地流程、迁移与部署 |
| 4 | [api.md](./api.md) | API 文档：REST 契约、响应格式、全量接口表、错误码 |

## 3. 与全局文档的关系

本目录是对 [`docs/project-architecture.md`](../project-architecture.md) 第 2 节"技术方向"与第 8 节"博客核心模块"的后端落地细化。

需要注意的偏离点：`project-architecture.md` 原始选型写的是 **Prisma + PostgreSQL**，本目录确定改用 **MikroORM + PostgreSQL**。原因与迁移影响见 [`tech-stack.md` 第 4 节](./tech-stack.md#4-mikroorm)。

## 4. 前后端协作约定

前端已在 `src/frontend/web-blog/nuxt.config.ts` 预留 `runtimeConfig.public.useMockRepo` 开关：

- `true`：组合式函数从 `features/<domain>/mock.ts` 直接取数据（当前默认）
- `false`：组合式函数走 `$fetch` / `useAsyncData`，目标指向 `NUXT_PUBLIC_API_BASE_URL`

切换步骤详见 [`development.md` 第 10 节](./development.md#10-前后端联调切换)。所有后端响应字段都严格对齐 `src/frontend/web-blog/app/features/<domain>/types.ts`，组件无需改动，只替换数据源即可。

## 5. 维护约定

- 任何实体 schema / 接口参数 / 响应结构变更，必须**同步更新 [api.md](./api.md)**，并在其"变更历史"追加一行
- 技术栈版本升级或替换，必须**同步更新 [tech-stack.md](./tech-stack.md)**，并简述影响面
- 新增业务域或调整边界，必须**同步更新 [requirements.md](./requirements.md)** 与 [api.md](./api.md)
- 开发流程、部署方式调整，必须**同步更新 [development.md](./development.md)**

文档与实现偏离时，以实现为准，但必须在一周内回补文档，且在 commit message 中显式说明原因。
