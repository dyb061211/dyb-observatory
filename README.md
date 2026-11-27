# DYB 观测站

一个可以在星系间航行的个人网站。滚动星图，点击星体，沿途可以读博客、翻看 GitHub 项目和生活近况，也可以在黑洞视界找到我的联系方式。[进入观测站](https://ddddddyb.com/)

星系和穿越动画使用 JavaScript、WebGL 和 Canvas 绘制。博客和生活记录由 TypeScript 服务端处理，草稿与已发表版本存放在 Cloudflare D1。GitHub 项目页会自动获取公开仓库。

## 在本地运行

需要 Node.js 22.13 或更高版本及 npm。在项目根目录安装依赖并构建，生成 Wrangler 的本地数据库配置。

```sh
npm ci
npm run build
```

首次运行时，在 macOS 或 Linux 终端依次执行迁移，初始化本地数据库。

```sh
for migration in drizzle/*.sql; do
  node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js \
    d1 execute DB --local --config dist/server/wrangler.json \
    --persist-to .wrangler/state --file "$migration" || break
done
```

运行 `npm run dev`，打开终端显示的本地地址。在博客页点击「登录测试作者」，即可在本机体验写作、保存草稿和发表文章。

## 用 Claude Code 修改源码

把仓库克隆到电脑后，在仓库根目录运行 `claude`。Claude Code 会读取 [CLAUDE.md](CLAUDE.md)，然后可以直接修改这个目录里的文件。按上面的步骤启动本地预览，就能检查改动。

用有写入权限的 GitHub 账号可以提交并推送改动。要把改动更新到线上观测站，从已修改的源码构建并发布到现有的 ChatGPT Sites 站点。
