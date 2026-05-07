# dairybook

一个网页版日程手帐：在 24 小时网格里记录每天每个时段做了什么，多设备同步，数据存在你自己的 GitHub 私有仓库里。零后端。

## 自部署

### 1. fork 这个仓库

启用 GitHub Pages（settings → Pages → Source: GitHub Actions）。

### 2. 创建一个 GitHub App

`Settings → Developer settings → GitHub Apps → New GitHub App`：

- Homepage URL：你的 Pages URL
- 启用 **Device flow**
- Permissions：
  - Repository permissions:
    - **Contents**: Read and write
    - **Metadata**: Read-only
- Where can this be installed: Only on this account
- 创建后记下 **Client ID**

### 3. 创建 dairybook-data 模板仓库

新建一个仓库 `dairybook-data-template`（私有，作为模板）：

- 包含一个 `data/.keep` 空文件，一个简单的 `README.md`
- Settings → 勾选 **Template repository**

### 4. 配置环境变量

在仓库 Settings → Secrets and variables → Actions → Variables 加：

- `VITE_GH_APP_CLIENT_ID`: 第 2 步的 Client ID
- `VITE_DATA_REPO_TEMPLATE`: `https://github.com/<your-account>/dairybook-data-template/generate`
- `VITE_GH_APP_INSTALL_URL`: `https://github.com/apps/<your-app-name>/installations/new`

### 5. 第一次使用

打开 Pages URL → 登录 → 创建 dairybook-data 仓库（私有）→ 把 GitHub App 装到该仓库 → 回 dairybook 点"检查就绪"。

## 开发

```bash
pnpm install
cp .env.example .env  # 填入测试值
pnpm dev              # http://localhost:5173
pnpm test             # 单测 + 组件测试
pnpm test:e2e         # Playwright e2e
pnpm build            # 生产构建到 dist/
```
