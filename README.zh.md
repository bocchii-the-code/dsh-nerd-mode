[![English](https://img.shields.io/badge/English-switch-d0d7de)](./README.md) [![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-current-2f81f7)](./README.zh.md)

# Nerd Mode — dsh 学习开关

一个学习开关加两个学习技能。`/study` 讲清一个概念或做完一个任务，不写任何文件。`/study-plus` 对着有日期的学习者记录跑一次完整会话。开关打开后，任何模式下教学都是默认姿势。

## 运行环境

- 装有 profile 的 DeepSeek Harness。
- Node.js 22.19 或更新。
- Windows、macOS 或 Linux。

## 安装

从 npm：

```powershell
dsh plugin --profile <profile> add dsh-nerd-mode
```

从 GitHub：

```powershell
dsh plugin --profile <profile> add github:bocchii-the-code/dsh-nerd-mode
```

从本地目录或压缩包：

```powershell
dsh plugin --profile <profile> add C:\path\to\dsh-nerd-mode
```

重启 dsh。每个模式都会多出 `/study-mode` 命令，会话标题栏多一个 `Nerd mode` 开关。模式选择器不会多出新条目：插件挂在 profile 层，不是预设。

## 使用方法

```text
/study-mode on          这次对话进入教学姿势
/study-mode off
/study <概念或任务>
/study-plus <主题>      带四个学习文件的记录型会话
```

标题栏的开关发的是同一条命令。它一直显示，关闭时变暗。

### 两种课程

`/study` 和 `/study-plus` 是同一个引擎的两个尺度。按"回答结束之后你还需要什么"来选。

| | `/study` 快速课程 | `/study-plus` 长课程 |
|---|---|---|
| 写文件 | 从不 | `study/<主题>/` 下四个文件 |
| 读文件 | 从不 | 开口前先读那四个 |
| 提问 | 分叉处一次 | 每个概念三道题，加一次复述 |
| 批改 | 不批 | 先写评分标准，再判 pass 和 miss |
| 记得你 | 只在这个会话里 | 跨会话，带日期 |
| 典型长度 | 一次坐完，一个概念 | 15 到 30 个概念，跨几周 |
| 适合 | 现在就想弄懂的一个问题 | 要学一阵子的一门东西 |

### 快速课程

用在"回答完之后你要能自己讲出来"的场合。

```text
/study 为什么 Adam 要除以 1 - β^t
/study 帮我把这个文件里的预条件子讲清楚          # 带代码
/study 帮我把第三题做完，每一步都说原因          # 带作业
```

你会拿到：标题、中心思想、编号步骤、符号多时的一张符号表、一个具体例子、常见错误，以及在真正改变结果的那个分叉点停一次。

如果是任务，还会拿到做完的东西，每一步旁边一行理由。

不会冒出任何文件，也不会打分。想留记录，就升到下一档。

开关打开时可以不敲命令：学习类的请求默认就是这个形状。

### 长课程

用在"这个话题会活过这次对话"的场合。

```text
/study-plus 洗发水与 Adam 优化器          # 第一次建图
/study-plus                               # 之后继续同一话题
/study-plus 我想学到矩阵平方根            # 设一个目标
```

第一次：它给出 15 到 30 个概念和前置关系，等你确认。你删改一行，再说哪些你已经会了可以跳过。然后它一次教一个概念，五步走：先冷问一个旧概念、讲到完整、三道没见过的题、一次复述、写一条带日期的记录。

之后的会话先读那四个文件，所以开口第一句就是下一个概念是什么、为什么是它、支撑它的证据是哪一天。

### 怎么选

- 问完就不会再回来的问题，用 `/study`。
- 要连着几周的东西，用 `/study-plus`。
- 先用 `/study`，发现自己一直在回来，就升档。概念图建一次，之前聊过的内容照样用得上。

举个例子。你在读 Shampoo 那篇论文，卡在预条件子上。`/study Shampoo 的预条件子到底在做什么`，一次坐完。如果你决定认真读完这篇论文，就开 `/study-plus 洗发水与 Adam 优化器`，让它先把顺序排出来。

## 开关做了什么

- 它改的是文字，不是工具。工具目录和提示缓存都不变。
- 只对学习类请求生效：讲清概念、辅导作业、讲解代码、准备考试。写功能、查资料、改配置、跑命令照常。
- 按会话生效。状态存在会话日志里，压缩上下文和恢复会话都不丢。
- 子代理各自跑自己的会话，所以默认都是关闭的。
- 它删不掉基础模式的人格文字，只能声明自己的规则优先。

## 内置技能

- `study`：引导式讲解。不写文件，不打分。
- `study-plus`：记录型会话。五步、概念图、证据日志。
- `diagram`：一个概念一张 SVG 图。为本包编写。
- `answer-me-with-html`：一页式 HTML 图解，作者 QingYunA。
- `teach`：带日期的教学工作区，作者 Matt Pocock。
- `writing-beats`：逐拍结构的文章写法，作者 Matt Pocock。
- `humanizer`：把 AI 味的文字改回人话，作者 Siqi Chen。
- `convert-documents-to-markdown`：Word、PDF、电子书转换，作者 firecrawl。

## 说明

- 插件用 `!!js` 表达式从 `cordis.patch.yml` 加载自己的 `skills/` 目录。补丁是宿主进程代码，改之前先读。
- 如果你改了包名，记得同步 `cordis.patch.yml` 里的 `resolve('dsh-nerd-mode/package.json')`。
- 随包的第三方技能各自保留许可，见 [NOTICE.md](./NOTICE.md)。
- 设计记录：[SPEC.md](./SPEC.md)、[GLOSSARY.md](./GLOSSARY.md)、`docs/adr/`。
- 在 `@deepseek-ai/dsh` 0.2.1-rc.3 和 Node 22 上测过。

## 卸载

```powershell
dsh plugin --profile <profile> remove dsh-nerd-mode
```

## 许可

MIT。随包的第三方技能各自保留许可，见 [NOTICE.md](./NOTICE.md)。
