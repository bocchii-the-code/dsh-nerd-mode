<p align="center">
  <img src="assets/nerd.svg" width="280" alt="手绘的书呆子，粗框眼镜，两颗门牙">
</p>

<h1 align="center">Nerd Mode：dsh 学习开关</h1>

<hr>

<p align="center"><em>一次一个概念，聊天结束后记录还在。</em></p>

<p align="center">
  <a href="./README.md"><img src="https://img.shields.io/badge/English-switch-d0d7de" alt="English"></a>
</p>

聊天里的学习通常在答案到达时就结束了。没人检验你有没有弄懂，关掉窗口也什么都不剩。Nerd Mode 让 dsh 一步步地教，在换个选择就会改变结果的地方停下来，遇到值得跟的主题就留下带日期的记录。这样一个主题能撑过几周，而不只是一次对话。

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

重启 dsh。每个模式都会多出 `/nerd-mode` 命令，输入框工具栏多一个 `Nerd Mode` 胶囊。模式选择器不会多出新条目，因为插件挂在 profile 层，不是预设。

## 使用方法

问一个问题，Nerd Mode 会走两条路中的一条。两条都分步骤讲，都会在分叉点停下来问一次。区别在于它们留下什么。

<p align="center">
  <img src="assets/two-paths.svg" width="720" alt="左右两栏对照。左边 /study 只处理一个问题和一个答案，讲完就结束。右边 /study-plus 先建概念图，再分 Book、Chapter、Section，每个概念一份讲义，并跨周记录每节课。">
</p>

### 快速课程：`/study`

把一个概念或一个任务从第一步走到最后一步，只在分叉点停一次。概念按层次讲，先直觉，再术语，最后形式细节。任务直接产出成品，每一步旁边写一行理由。它不打分，也不保存学习者记录。只在你指定路径时保存讲稿或成品，需要图时会画一张 SVG。`/study-plus` 写讲义时遵循的写作规则，也只有这一份。

适合现在就想弄懂、之后大概不会再回来的问题。

- 读论文卡在一个术语上。
- 今晚必须交的一道作业。
- 改代码之前，要先把这段逻辑理顺。
- 一个不大的选择，想先看清取舍再决定。

```text
/study 为什么 Adam 要除以 1 - β^t
/study 帮我把这个文件里的预条件子讲清楚          # 带代码
/study 帮我把第三题做完，每一步都说原因          # 带作业
```

敲命令，或者打开开关直接问。开关打开时，学习类的请求默认就是这个形状。

显式输入 `/study-plus` 会直接进入带记录的会话，即使请求里有多个概念。显式输入 `/study`，或者打开 Nerd Mode 后直接提问，如果请求里有多个互相独立的概念，会先问一次：要在聊天里一次性给出书式的完整讲解，还是走带记录的 `/study-plus`。前者用普通 Markdown，一级标题是书名或题目，二级标题是章，三级标题是节。

你会拿到：标题、中心思想、编号步骤，每个公式上方一行符号说明。四个以上符号被多个公式反复用到时，开头再加一张速查表。然后是一个具体例子、常见错误，以及在分叉处停的那一次。任务是另外给你做完的东西和每一步的理由。

它不打分，不保存记录，也不能跨会话接着教同一个主题。讲稿或其他成品只在你要求时才保存，存到你指定的路径。

### 长课程：`/study-plus`

把一个主题组织成一本 Book，下面分 Chapter，每个 Chapter 下分 Section。每个 Section 只放一个概念。它按先修顺序建概念图，把概念分进各章，每次只教一个概念，也只考这个概念的掌握情况。概念图里同时带 Chapter 和 Section 两列，所以一张图里既有阅读顺序，也有先修顺序。它维护三个记录文件，并为每个概念保存一份 Markdown 文件，放在 `study/<slug>/lectures/`。你批准概念图后，它会为每个概念先写好一份完整讲稿，开讲不用等准备。它用已保存的材料生成一个 HTML 书页，材料有变化就自动刷新。

适合下个月你还在学的东西。

- 认真读一本教材、一门课或一篇论文。
- 想让教材的章节目录成为之后复习的骨架。
- 需要知道下一步该学什么，而不只是现在该问什么。
- 想要进度的证据，而不是感觉。
- 你总在反复查同一批东西，查完就忘。

显式输入 `/study-plus` 会直接开始带记录的会话，即使主题里有多个概念，也不会再问一次性讲解还是带记录讲解。

```text
/study-plus 洗发水与 Adam 优化器          # 第一次建图
/study-plus                               # 之后继续同一话题
/study-plus 第 2 章                       # 按书中顺序读这一章
/study-plus 矩阵平方根                    # 直接跳到某个概念
```

第一次会话按固定顺序走。

```text
/study-plus <主题>
  按先修顺序给出 15 到 30 个概念，分进各章
  章节列表和概念表一起给你看，然后等你确认
  你批准、修改或重建概念图
  你回答一轮开课校准：目标、背景，以及哪些概念可以跳过
  为每个概念写一份完整讲稿，跳过的也写
  逐个概念教：课前回忆（可选）→ 讲义 → 设置数量的没见过的题 → 复述 → 带日期的记录
```

批准概念图后先问一轮开课校准：这个主题你想学到能做什么，以前接触过什么，概念图里哪些概念可以直接跳过。答案决定 `graph.md` 里的 `Teaching level` 一行，`Goal` 和 `Background` 也一并写入，之后每份讲义都按这个教学深度来写。深度只管讲义，不管题目、复述和记录。中途改的深度只对这次会话有效，说「以后都这样」才会改写那一行。

<p align="center">
  <img src="assets/calibration.svg" width="720" alt="开课校准流程：你批准概念图，回答一轮关于目标、背景和可跳过概念的提问，答案定出教学深度。beginner 拆成编号步骤并解释每个术语，standard 沿用现在的写法，advanced 只讲一遍、每个想法最多一个例子。深度写进 graph.md，只管讲义。">
</p>

讲稿只是准备，不算学过。每份讲义都按 `/study` 的写作规则写，并且先保存再显示。

概念图删掉的概念，它的讲义文件会移到 `lectures/archive/`，不会被删除。

之后的会话先读记录文件。你挑一章或一个概念，它用一句说明这个概念的现状和它先修概念的现状。先修不会强制你按顺序走。

Profile 默认值在 设置 -> Nerd Mode。它管的是记录型会话：每次开讲前是否先来一次课前回忆，一节课后问几道没见过的题，题型是简答、四选一还是混合。保存从下一节课开始生效；取消只丢草稿；恢复默认回到关闭、3 题、简答。在一次 `/study-plus` 请求里明确说出的偏好，只对那一次会话生效。

你会拿到：一套阅读顺序和一套先修顺序、你想学的任何一个概念、只针对这个概念的批改、一份保存下来的讲义，以及重启也还在的记录。HTML 书页会在每次批量写稿和每节课后刷新，每节一页，按原来的节顺序排列，支持全文搜索，还没讲过的内容标成草稿。

HTML 书页保留每个 Section 在概念图里的原编号，也就是教材里的节号，即使前面的讲义文件还没保存。每个 Chapter 的计数只算实际收进书里的 Section。

它不排复习时间表，也不猜你会什么。只有你自己做出来的答案才能改变记录。先修没学也不会拦住你想学的概念。它会讲清或建议先修，选哪个仍然由你决定。

### 两者会留下什么

| | `/study` 快速课程 | `/study-plus` 长课程 |
|---|---|---|
| 写文件 | 只在你指定路径时保存讲稿或成品，需要图时会画 SVG | `study/<主题>/` 下的概念图、状态、日志，每个概念一份文件，`book.html` 自动刷新 |
| 读文件 | 默认不读，但会读写你指定的成品路径 | 开口前先读那三个 |
| 下次还记得 | 不记得 | 记得，带日期 |
| 批改 | 不批 | 按概念批，先写评分标准 |
| 组织方式 | 一个概念、一个任务，或一次性的书式讲解 | Book、Chapter、Section |
| 典型长度 | 一次坐完，一个概念 | 15 到 30 个概念，跨几周 |

`/study` 自己不会建 `study/` 文件夹。讲稿和成品只会存到你指定的路径，包括 `study/<主题>/lectures/` 下的普通文件。图默认放在 `diagrams/<topic>/`，除非你另指路径。它不得读写 `graph.md`、`state.md`、`log.md` 或 `plan.md`。

### 怎么选

<p align="center">
  <img src="assets/choose-a-mode.svg" width="720" alt="一个问题，这个主题你还会再回来吗，分成是和否两支。否走 /study，一次坐完，不留记录。是走 /study-plus，连着几周上课，留下带日期的记录。一条标着「还会回来」的弧线箭头从 /study 指向 /study-plus。">
</p>

- 问完就不会再回来的问题，用 `/study`。
- 要连着几周的东西，用 `/study-plus`。
- 想让教材的章节目录成为复习骨架，用 `/study-plus`，它会把教材的章映射成 Chapter。
- 先用 `/study`，发现自己一直在回来，就用 `/study-plus` 建一次概念图，之前聊过的内容照样用得上。

举个例子。你在读 Shampoo 那篇论文，卡在预条件子上。`/study Shampoo 的预条件子到底在做什么`，一次坐完。如果你决定认真读完这篇论文，就开 `/study-plus 洗发水与 Adam 优化器`，让它先把顺序排出来。

### 命令

```text
/nerd-mode on           这次对话进入教学姿势
/nerd-mode off
/study <概念或任务>
/study-plus <主题>      带三个记录文件的记录型会话
```

书页不是命令。`/study-plus` 每次批量写稿和每节课后自动刷新，上一版会留成 `book.html.bak`。

输入框工具栏里的胶囊发的就是 `/nerd-mode`。它排在 Full Throttle 左边，一直显示，关闭时变暗。

## 开关做了什么

- 它改的是文字，不是工具。工具目录和提示缓存都不变。
- 只对学习类请求生效：讲清概念、辅导作业、讲解代码、准备考试。写功能、查资料、改配置、跑命令照常。
- 开关只作用于这一次会话。状态存在会话日志里，压缩上下文、恢复会话都不丢。
- 命令执行失败时，窗口顶部会弹一条说明原因的提示，胶囊保持原状态。
- 子代理各自跑自己的会话，所以默认都是关闭的。
- 它删不掉基础模式的人格文字，只能声明自己的规则优先。

## 内置技能

- `study`：不打分的引导式讲解，也是讲义的写作标准。按需存文件，需要图时会画。
- `study-plus`：记录型会话。Book、Chapter、Section，每个概念一份讲义，按概念批改。
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
- 设计记录：[SPEC v3](./docs/specs/2026-10-28-study-plus-v3.md)、[v2，历史版本](./docs/specs/2026-10-27-study-plus-v2.md)、[会话默认值](./docs/specs/2026-10-28-nerd-mode-settings.md)、[GLOSSARY.md](./GLOSSARY.md)、`docs/adr/`。文档结构见 [docs/README.md](./docs/README.md)。
- 在 `@deepseek-ai/dsh` 0.2.1-rc.3 和 Node 22 上测过。

## 卸载

```powershell
dsh plugin --profile <profile> remove dsh-nerd-mode
```

## 许可

MIT。随包的第三方技能各自保留许可，见 [NOTICE.md](./NOTICE.md)。
