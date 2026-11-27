# DYB 观测站

这是一个基于 TypeScript、Vinext 和 Cloudflare D1 的个人网站，公开地址是 https://ddddddyb.com/。本地安装、数据库初始化和预览见 [README.md](README.md)。

## 源码位置

- `app/route.ts` 和 `views/sky.html` 负责首页星图及入口，`public/assets/flight*.js` 负责星图航行，`public/assets/entry-flight.js` 与 `public/assets/passage.js` 负责进入星系时的动画。
- `app/[station]/route.ts`、`lib/interiors.ts` 和 `lib/writing-view.ts` 负责各星系页面、博客和写作界面。
- `lib/entries.ts`、`db/schema.ts` 与 `drizzle/` 负责文章数据和数据库迁移。在本地可通过「登录测试作者」测试编辑与发表。
- `public/notes/` 和 `public/projects/` 保存现有的独立文章和项目示例。

运行 `npm run build` 检查改动。GitHub 仓库存放源码，线上版本由 ChatGPT Sites 发布，本地数据库用于开发预览。
