# WeChat Obsync

微信文章同步到 Obsidian 的完整解决方案。

## 项目结构

```
wechat-obsync/
├── backend/           # Cloudflare Workers 后端
│   ├── src/
│   │   ├── index.ts   # 主入口和 API 路由
│   │   └── types.ts   # TypeScript 类型定义
│   ├── wrangler.toml  # Cloudflare 部署配置
│   └── package.json
│
├── miniprogram/       # 微信小程序
│   ├── pages/
│   │   ├── index/     # 首页
│   │   ├── bind/      # 绑定页面
│   │   ├── save/      # 保存文章页面
│   │   └── articles/  # 文章列表页面
│   ├── services/
│   │   └── api.js     # API 服务
│   └── ...
│
└── plugin/            # Obsidian 插件（待修改）
```

## 部署步骤

### 1. 部署后端

1. 注册 [Cloudflare](https://dash.cloudflare.com/)
2. 安装 Wrangler CLI: `npm install -g wrangler`
3. 创建 KV Namespace:
   ```bash
   cd backend
   wrangler kv:namespace create "OBSYNC_KV"
   ```
4. 更新 `wrangler.toml` 中的 KV ID
5. 部署:
   ```bash
   wrangler deploy
   ```
6. 复制 Workers URL 更新到小程序的 `services/api.js`

### 2. 配置微信小程序

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 创建小程序，填写 AppID 到 `project.config.json`
3. 下载 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
4. 导入 `miniprogram` 目录
5. 更新 `services/api.js` 中的 API URL
6. 提交审核发布

### 3. 配置 Obsidian 插件

修改 `wechat-obsync` 插件的 `data.json`，将 `apiBaseUrl` 改为你的 Workers URL。

## 功能特性

- ✅ 微信文章保存到 Obsidian
- ✅ 支持公众号名称和作者
- ✅ 自动生成 markdown 格式
- ✅ 增量同步（只同步未读文章）

## 注意事项

- 需要有效的微信小程序账号
- Cloudflare Workers 免费额度足够个人使用
- Obsidian 插件需要修改配置连接新后端
