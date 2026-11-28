# DYB 个人博客

这是一个基于 TypeScript、Vinext 和 Cloudflare D1 的个人博客网站，公开地址是 https://ddddddyb.com/。本地安装、数据库初始化和预览见 [README.md](README.md)。

## 源码位置

- `app/route.ts` 与 `app/[station]/route.ts` 负责博客首页 `/` 及 `/projects`、`/life`、`/profile` 路由（`/blog` 重定向到 `/`）。
- `lib/writing-route.ts`、`lib/interiors.ts` 和 `lib/writing-view.ts` 负责全站统一页面外壳、文章列表、阅读页与写作台；样式与深浅色切换在 `public/assets/blog.css` 和 `public/assets/color-mode.js`。
- `lib/entries.ts`、`db/schema.ts` 与 `drizzle/` 负责文章数据和数据库迁移。在本地可通过「登录测试作者」测试编辑与发表。
- `public/notes/` 和 `public/projects/` 保存现有的独立文章和项目交互示例。

运行 `npm run build` 检查改动。GitHub 仓库存放源码，线上版本由 ChatGPT Sites 发布，本地数据库用于开发预览。
