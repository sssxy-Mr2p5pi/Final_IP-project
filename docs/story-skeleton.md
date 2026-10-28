# 全故事骨架填充指南

这是中文开发预览，所有中文提纲、临时选项和几何图片均需作者审阅或替换。正式英文继续由作者写作。源码只维护 `src/story.twee`。

## 打开与交接

双击 `05-open-twine.cmd`，选择 **Final IP — Story Skeleton**。Build → Play 使用编辑器当前内容；`03-preview.cmd` 使用已经导出的 Twee。

编辑后使用 Build → Export as Twee 保存到 `src/story.twee`，执行 `07-checkpoint.cmd`，再交接技术修改。`08-compare-author-text.cmd` 核对已有 author-text。新填的正式段落添加 author-text 标签；同一时刻由一方编辑。导入新版 HTML 前先备份，避免旧故事覆盖新源码。

## 节点职责

| 标签／名称 | 编辑内容 |
|---|---|
| scene | 时间点与路线，保持名称稳定 |
| content-zh | 中文提纲，逐项替换为作者英文 |
| 场景_Self、Thinking、Pending | 当前自述、思考与任务 |
| 场景_Reports、Diary、Crew | 在该阶段解锁的记录，后续可回看 |
| 场景_Enter、场景内 sceneActions | Enter 控制解锁；场景节点首行的 sceneActions 放临时操作及连接，使 Twine 地图显示实际连线 |
| 场景_Media | 本地素材、日期、音轨与字幕时间 |
| 场景_Notes | 作者资料摘录，仅在编辑器查看 |
| technical | 共用界面和逻辑 |
| legacy | 旧作者保护测试段，脱离正式路线但保留原文 |

可编辑场次前缀：`TMinus3`、`TMinus2`、`TMinus1`、`T0`、`T05`、`T1` 至 `T7`、`E1` 至 `E5`、`FinalE2`、`FinalE5`。例如 T0 的普通文字在 T0_Thinking，四格画面在 T0_Media。

开场三段字幕在 `TMinus3_Subtitle1`、`TMinus3_Subtitle2`、`TMinus3_Subtitle3`，由 `Opening` 按段显示；配音字幕可写入 TMinus3_Media。`SelfVision` 是实际执行自身预测后的画面入口。结局后两个最终镜头分别在 FinalE2 和 FinalE5。

所有场次的正式正文、图像、语音、DAY 数及具体演出均未完成。冲突人物、实施手段和精确耗能留给作者，不自动补全。

## 条件记录与动作

`Recall_Reveal_*` 与 `Recall_Hide_*` 对应 T0 公布状态。`ReportGiven_Diary` 和 `ReportKept_Diary` 区分私下交付；`Public_*` 只在 T5 已公开时出现。`SelfForecast_*` 仅实际预测后出现。`Blocked_*` 仅 E5 的 T5 起出现；`Degraded_Diary` 仅 E2/E3。

记录累积保存，同一条只解锁一次。已有条目保持历史时点的语义，不随当前场景重写。新增某场专属条件段时，建立内容节点并在对应 Enter 节点登记；更改路线条件需要技术接线。

T0 暂缓时留在本场。T0.5 四个临时选项模拟答复结果。T3 只统计实际完成的 R/P：两项完成自动推进，一项或零项须明确结束交易。E1 跳过 T5/T6，E4 在 T0.5 退出；E5 T4 仍正常提问、T5 起封锁。

## 素材替换

Media 节点是 JSON，保留引号、逗号和字段名。图片路径相对运行 HTML。新增素材时登记 `assets/manifest.json`，再构建，素材会同步到 Twine 的 Play 目录。

```json
{
  "day": "待定",
  "transitionMs": 650,
  "camera": ["assets/images/skeleton/T0-camera-1.svg", "assets/images/skeleton/T0-camera-2.svg", "assets/images/skeleton/T0-camera-3.svg", "assets/images/skeleton/T0-camera-4.svg"],
  "prediction": "assets/images/skeleton/T0-prediction.svg",
  "closing": "assets/images/skeleton/T0-closing.svg",
  "audio": "",
  "subtitles": [],
  "hotspots": []
}
```

- 替换同路径图片即可更新画面；更换扩展名时同时改 Media 和素材登记。
- audio 留空不会发起音频请求。填入本地路径后出现点击播放入口，换场停止旧音轨，重复点击不叠播。
- subtitles 可填 `{ "start": 0, "end": 2.5, "text": "作者字幕" }`，单位为秒，随本场音轨播放更新。
- day 是独立日期标签，场次号不代表天数。transitionMs 控制基础转场时长。
- hotspots 当前仅为保留位，不执行。Terminal 词块仅作排列演示，不判断语义，也不提交剧情回答。

复杂动画、自动追加不同思考、逐字退化、可编辑日记与跨次保存均未实现。当前支持沿已确定路线补内容；新增剧情规则或新的互动类型仍需接线。

## 开发工具与检查

底部开发检查默认收起，包含剧透。跳转会清空当前进度并种入一致的历史，供检查后半程；正常试玩从开场开始。重新开始会清空 Harlowe 状态。

Camera 与抽屉只改视图，保留本场拼词和 Thinking 阅读位置。日志按实际进度解锁，普通面板不展示作者资料或未来结局。

执行 `npm run package` 生成 `releases/final-ip-story-skeleton-dev.zip`。`npm test` 检查 10 种主线组合、6 种 E4 组合及三窗口布局；`npm run test:twine` 检查桌面导入导出往返；`npm run test:author` 检查文字保护；`npm run test:media` 检查素材替换、长日志和开发跳转。结果位于 evidence/tests。

技术通过与正式作品完成分别记录。另一台电脑运行、听感、正式文字与画面质量仍需人工确认。

部分使用 goto 的场景带有 `(if: false)` 地图连接提示，供 Twine 画线，运行时不执行。改目标时同步提示与实际动作。

## 按场填充入口

每行的 `X` 表示节点前缀。正文填入 `X_Thinking` 等内容节点；图片为 `assets/images/skeleton/X-camera-1.svg` 至 `4.svg`、`X-prediction.svg`、`X-closing.svg`。音频路径、字幕时间点和转场参数填入 `X_Media`。表内列出的正式文本、素材、时间与演出均待完成，保留当前中文提纲即可继续走通。

| X | 本场重点补充 |
|---|---|
| TMinus3 | 三段开场字幕、配音、黑场或模糊主观镜头；当前没有四区界面 |
| TMinus2 | 初见界面、旧日志、旧报告和摄像头观察 |
| TMinus1 | 粒子事件、测量记录与首次自述 |
| T0 | 航路问题、预测画面、公布与隐瞒对应记录 |
| T05 | 轨迹问题、有效回答的互动；当前用四种临时结果代替 |
| T1 | 被反复询问的过程、资源记录 |
| T2 | 接近与招揽的对话、观察 |
| T3 | 报告交付和自身预测的操作演出；保留当前动作顺序逻辑 |
| T4 | 读数矛盾与争执；E5 此时仍正常提问 |
| T5 | 公开报告后的冲突／未交报告的资源冲突／E5 提问封锁 |
| T6 | E2、E3 的能力退化；E5 的信息封锁 |
| T7 | 各路线的收束过渡 |
| E1 | 枯竭后的等待与回收演出 |
| E2 | 感知丧失与保全处置 |
| E3 | 毁灭演出；具体实施者和手段仍待作者确定 |
| E4 | 三种停用原因对应记录、救援及拆解 |
| E5 | 剩余记录、只剩男人的场面 |
| FinalE2 | 外部揭示镜头与最后提问 |
| FinalE5 | 男人独白与空白回答页 |

`SelfVision` 使用 `SelfVision_Thinking` 和 `SelfVision_Media`，默认引用 T3 的预测占位图。修改某个事实提纲时直接替换内容节点正文，保留节点名；例如把 `TMinus2_Diary` 的一句提纲替换为小组写好的英文日记，再添加 `author-text` 标签。该段会在原定时间解锁，后续自动列入可重读记录。

地图里的空内容节点是预留位置。新增日志正文后，需要让对应 Enter 将该节点加入 diary／crew／reports 数组，才会解锁；当前已有内容的节点都已接入。
