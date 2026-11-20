# DYB 观测站

一个可以在星系间航行的个人网站。滚动星图，点击星体，沿途可以读博客、翻看 GitHub 项目和生活近况，也可以在黑洞视界找到我的联系方式。[进入观测站](https://dyb-observatory.happy-myna-7445.chatgpt.site/)

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
