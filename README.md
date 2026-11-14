# Komeiji Bibliotheca · 古明寺藏书阁

欢迎来到古明寺藏书阁~  
Welcome to Komeiji-Bibliotheca!

古明寺藏书阁是一个本科生讨论班，主要关注数理基础科学，此站是讨论班文章的静态站点。

[点此访问](https://draaaft.github.io/Komeiji-Bibliotheca/)


## 技术栈

Astro 7（静态输出）· satteri + satteri-katex · 原生 TypeScript · CSS

## 本地开发

需要 Node 22+。

```sh
npm install
npm run dev
```

构建与预览：

```sh
npm run build
npm run preview
```

## 添加文章

在 `src/content` 下新建 `.md` 文件，目录结构就是 URL：

```
src/content/semiconductor/energy_band.md  →  /semiconductor/energy_band/
```

frontmatter 全部可选：

```yaml
---
title: 标题            # 省略时取正文第一个 H1，再退回文件名
author: 作者
pubDate: 初次发布日期
update: 最后一次编辑日期
description: 摘要
tags: [半导体, 能带]
draft: false           # true 时不出现在列表和路由中
---
```

正文若已有 H1，页面不会再插入标题。作者、日期和标签会渲染在 H1 下方。

图片放在 Markdown 同目录的 `<文件名>.assets/` 中，用相对路径引用：

```md
![示意图](energy_band.assets/figure.png)
```

缺失的图片会显示占位块，不会中断构建。

## 目录结构

```
src/
  content/            Markdown 文章，目录即文件树
  content.config.ts   docs 集合的 loader 与 schema
  lib/                集合读取、站点 base、Markdown 插件
  layouts/            IDE 外壳
  pages/              首页、藏书阁、搜索、标签、文章页
  components/         文件树、搜索列表、大纲、面包屑、图标
  scripts/            标签页与页内交互
  styles/             全局样式
```

## 部署

推送到 `main` 后由 GitHub Actions 发布到 GitHub Pages。站点部署在 `/Komeiji-Bibliotheca` 子路径下，站内绝对链接需要经过 `withBase()`。

## License

MIT © 2026 Hilda
