# Komeiji Bibliotheca

古明寺藏书阁：以 `src/content` 为唯一内容源的静态站点，外壳是一个 IDE 风格的文件浏览器。

## 开发

```sh
npm install
npm run dev
```

其他命令：`npm run build`、`npm run preview`。

## 内容

- 目录结构就是侧边栏结构，每个 `.md` 文件对应一个页面，URL 与 `src/content` 下的路径一致。
  例如 `src/content/semiconductor/energy_band.md` 对应 `/semiconductor/energy_band/`。
- 首页和「全部藏书」都从 content collection 生成，新增文件后无需修改 HTML。
- 图片放在 Markdown 同目录并用相对路径引用；缺失的图片会显示占位块，不会中断构建。
- 公式 `$...$` 与 `$$...$$` 由 KaTeX 渲染。

可选 frontmatter：

```yaml
---
title: 能级与能带
description: 一句话摘要
date: 2026-11-05
tags: [semiconductor]
draft: false
---
```

`date` 用于排序和展示。没有 frontmatter 时，标题取第一个 `#` 标题，取不到则使用文件名。
