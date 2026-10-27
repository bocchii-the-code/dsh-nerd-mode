[![English](https://img.shields.io/badge/English-switch-d0d7de)](./README.md) [![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-current-2f81f7)](./README.zh.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/icon-dark.svg">
  <img src="assets/icon-light.svg" width="120" height="120" alt="Nerd Mode">
</picture>

# Nerd Mode：dsh 学习开关

聊天里的学习通常在答案到达时就结束了：没有检验，也留不下任何东西。Nerd Mode 改的是 dsh 面对一个问题时做的事。它一步一步地教，在该做选择的地方停下来，并且能留下带日期的记录，让一个主题活过几周，而不只是一次对话。

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

重启 dsh。每个模式都会多出 `/nerd-mode` 命令，输入框工具栏多一个 `Nerd mode` 胶囊。模式选择器不会多出新条目：插件挂在 profile 层，不是预设。

## 使用方法

两个技能，两种尺度。都一次只讲一件事，都会停下来问你。区别在于它们留下什么。

### 快速课程：`/study`

**它做什么。** 把一个概念或一个任务从第一步走到最后一步，只在分叉点停一次：那里换个选择，结果就不一样。概念按层次讲，先直觉，再术语，最后形式细节。任务则直接产出，每一步旁边写一行理由。它不读文件也不写文件，所以在任何文件夹里都能用，用完什么都不留。

**什么时候用它。** 现在就想弄懂、之后大概不会再回来的问题。

- 读论文卡在一个术语上。
- 今晚必须交的一道作业。
- 改代码之前，要先把这段逻辑理顺。
- 一个不大的选择，想先看清取舍再决定。

**怎么用。**

```text
/study 为什么 Adam 要除以 1 - β^t
/study 帮我把这个文件里的预条件子讲清楚          # 带代码
/study 帮我把第三题做完，每一步都说原因          # 带作业
```

敲命令，或者打开开关直接问。开关打开时，学习类的请求默认就是这个形状。

**你会拿到什么。** 标题、中心思想、编号步骤，符号多时再加一张符号表。一个具体例子、常见错误，以及在分叉处停的那一次。任务是另外给你做完的东西和每一步的理由。

**它不做什么。** 不会出现任何文件，也不打分。对话一结束，它就什么都不记得了。

### 长课程：`/study-plus`

**它做什么。** 为一个主题建一张概念图，然后每次会话只教一个概念，对着"你已经做出来过什么"的记录来教。记录是工作区里的四个 markdown 文件。每次开口前先读，每次结束时写，凡是说你会的句子都带日期。

**什么时候用它。** 下个月你还在学的东西。

- 认真读一本教材、一门课或一篇论文。
- 需要知道下一步该学什么，而不只是现在该问什么。
- 想要进度的证据，而不是感觉。
- 你总在反复查同一批东西，查完就忘。

**怎么用。** 第一次、之后、以及设目标。

```text
/study-plus 洗发水与 Adam 优化器          # 第一次建图
/study-plus                               # 之后继续同一话题
/study-plus 我想学到矩阵平方根            # 设一个目标
```

第一次：它给出 15 到 30 个概念和前置关系，等你确认。你删改一行，再说哪些你已经会了可以跳过。然后它一次教一个概念，五步走：先冷问一个旧概念、讲到完整、三道没见过的题、一次复述、写一条带日期的记录。

之后的会话先读那四个文件，所以开口第一句就是下一个概念是什么、为什么是它、支撑它的证据是哪一天。

**你会拿到什么。** 一个概念顺序、一个讲透的概念、一次批改过的检验，以及重启也还在的记录。

**它不做什么。** 不排复习时间表，也不猜你会什么。只有你自己做出来的答案才能改变记录。

### 两者会留下什么

| | `/study` 快速课程 | `/study-plus` 长课程 |
|---|---|---|
| 写文件 | 没有 | `study/<主题>/` 下四个文件 |
| 读文件 | 没有 | 开口前先读那四个 |
| 下次还记得 | 不记得 | 记得，带日期 |
| 批改 | 不批 | 先写评分标准，再判 pass 和 miss |
| 典型长度 | 一次坐完，一个概念 | 15 到 30 个概念，跨几周 |

工作区里如果出现 `study/` 文件夹，那是 `/study-plus` 做的。`/study` 从不创建它。

### 怎么选

- 问完就不会再回来的问题，用 `/study`。
- 要连着几周的东西，用 `/study-plus`。
- 先用 `/study`，发现自己一直在回来，就升档。概念图建一次，之前聊过的内容照样用得上。

举个例子。你在读 Shampoo 那篇论文，卡在预条件子上。`/study Shampoo 的预条件子到底在做什么`，一次坐完。如果你决定认真读完这篇论文，就开 `/study-plus 洗发水与 Adam 优化器`，让它先把顺序排出来。

### 命令

```text
/nerd-mode on           这次对话进入教学姿势
/nerd-mode off
/study <概念或任务>
/study-plus <主题>      带四个学习文件的记录型会话
```

输入框工具栏里的胶囊发的就是 `/nerd-mode`。它排在 Full Throttle 左边，一直显示，关闭时变暗。

## 开关做了什么

- 它改的是文字，不是工具。工具目录和提示缓存都不变。
- 只对学习类请求生效：讲清概念、辅导作业、讲解代码、准备考试。写功能、查资料、改配置、跑命令照常。
- 开关只作用于这一次会话。状态存在会话日志里，压缩上下文、恢复会话都不丢。
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
