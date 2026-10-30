# Final IP 开发工作区

本仓库用于四周硬科幻互动作品的技术准备。当前交付为离线技术样例；剧情设定初稿见 docs/剧情设定.md，正式正文与选项仍待小组撰写。

## 先用哪几个入口

| 入口 | 用途 |
|---|---|
| 00-setup.cmd | 下载锁定工具并安装测试依赖；首次需要联网 |
| 01-check-environment.cmd | 检查应用和构建工具 |
| 02-build.cmd | 从唯一故事源构建 dist/index.html |
| 03-preview.cmd | 构建后用默认浏览器打开本地样例 |
| 04-package.cmd | 生成 releases/final-ip-technical-prototype.zip |
| 05-open-twine.cmd | 打开 Twine 桌面应用 |
| 06-open-blender.cmd | 打开 Blender 便携版 |
| 07-checkpoint.cmd | 在 AI 技术修改前备份故事并记录作者文本 |
| 08-compare-author-text.cmd | 在 AI 技术修改后检查正文差异 |
| 09-test.cmd | 在本机 Chrome 与 Edge 中验证已解压的离线包 |

运行入口遇到错误会保留提示。检查失败时修复具体缺项，再重新执行。

## 日常编辑

本机已配置项目专用英文 Twine 编辑器并导入技术模板，使用 05-open-twine.cmd 打开。它使用 .local/twine-editor 配置和 .local/twine-library 故事库，与通用启动入口分开。换机或新增故事时，从 Import 导入构建得到的 dist/index.html。选择 Harlowe 3.3.9；详细步骤见仓库外指南。

正文节点 TextShort、TextLong 带 author-text 标签，供组员人工编辑。Start、ViewA、ViewB 带 technical 标签，当前含技术控件与测试选项。
新增正式文字节点时使用 author-text 标签。技术节点中的测试选项改为正式文案时，交还作者自行填写并纳入文本保护范围。

交接顺序：Twine 导出 Twee → 覆盖 src/story.twee → checkpoint → AI 技术修改 → compare → build → 预览 → 备份 Twine 原故事 → 导入新版 HTML。
交接期间一方编辑。Twine 自动保存不会自动更新 Git；每次结束编辑都需主动导出。

## 目录职责

- src：单份故事源，正文、样式与脚本同存。
- assets：运行图片、声音和来源登记。
- scripts：环境配置、构建、打包、交接及诊断工具。
- tests：具有明确预期的浏览器测试。
- docs：中文需求、设计、验收、决定、待办及剧情设定。
- evidence：实际环境与测试结果；大图和本地应用状态排除出 Git。
- delivery：进入运行包的英文说明和来源信息。
- art：手工制作的 Blender 工程和素材使用约定。
- .tools、.local、dist、releases：本机工具、交接备份及生成结果，均不提交。

个人阅读区在相邻 Final_IP-guide，包含中文操作指南、proposal 素材、纠偏与个人 Craft Memo 记录。

## 复现环境

Windows x64，需要 Git、Node.js 和 Python 3.12 或更新版本。先执行 00-setup.cmd，再执行环境检查、构建、打包和测试。
工具版本与 SHA-256 见 tools.lock.json。下载脚本读取系统代理；不修改全局代理或 PATH。项目本地依赖采用 package-lock.json 锁定。
Twine 按当前用户安装；Blender、Tweego 和 Harlowe 位于 .tools。测试使用已有 Chrome、Edge，不下载额外浏览器。

## 内容和提交边界

游戏及正式提交材料采用英文；开发资料允许中文。所有正式正文、选项文案和 proposal 由小组人工写作。
声音第一阶段仅验证本地播放与停止。默认场景渲染只证明 Blender 可用，正式 3D 画面由组员制作。
素材清单逐项登记来源与许可。技术夹具必须在最终作品中替换。
远端为 https://github.com/sssxy-Mr2p5pi/Final_IP-project 。代理仅做本地 commit，由用户 push。

具体实测结果见 evidence/tests/browser-tests.json、twine-roundtrip.json 和 evidence/environment/blender-render.json。
实际扬声器听感、另一台电脑运行和组员亲手完成 Twine 交接仍分别列为人工验收项。

## 初始验收记录（SugarCube，2026-10-15）

2026-10-15：Chrome、Edge各三个窗口配置共六组离线包检查通过；Twine实际导出和重新导入保真检查通过；作者文本保护器的正反例检查通过；Blender默认场景保存与CPU渲染通过。
图像与阅读面板截图已检查，视口横向溢出和热点位置检查通过。人工听感、另一台电脑与作者亲手交接仍待确认。

额外验证入口：`npm run test:twine` 检查Twine往返，`npm run test:author` 检查正文保护器。
先运行打包，再运行浏览器测试；源码有变化时需重新打包。

应用偏好：Twine和Blender均使用项目专用英文配置。重新配置入口为 `python scripts/configure_twine.py`，此操作保留已存在的编辑器故事。
Blender入口使用 .local/blender-config，操作系统的全局应用偏好保持独立。

## 当前格式与验证（Harlowe，2026-10-17）

当前源码、项目专用 Twine 故事和构建均采用 Harlowe 3.3.9。格式文件来自已锁定的官方 Twine 2.12.1 安装包。
初始化使用 startup 标签；选择、变量、条件、复用节点和重启使用 Harlowe 宏。阅读弹窗与单音轨播放由项目技术脚本补充。
Controls、Reader 是共用技术节点；TextShort、TextLong 的正文保持迁移前内容。

Harlowe 的 Chrome/Edge 六组离线检查、Twine 导出往返、内置 Play 图像与音频检查、正文保护器检查已通过。
新手操作见仓库外 `../Final_IP-guide/04-Harlowe入门与ViewA操作.md`。
图片和热点定位继续使用 HTML/CSS。Harlowe 的地图卡片用于管理节点，图片内热点坐标在 Stylesheet 中调整。

每次构建会把登记素材同步到项目的 Twine scratch 和 library 目录。
在 05 入口中使用 Build → Play 可以查看当前编辑；新增素材后需登记、导出并构建一次。
03-preview 读取导出的 src/story.twee。技术更新重新导入前，先备份 Twine 当前故事。
旧格式的故事与验证记录保存在本机 .local/before-harlowe-*，Git 也保留初始版本。

## 全故事开发骨架（2026-10-28）

当前默认构建为中文开发预览，尚非正式作品。T−3 到 E1–E5 的流程与条件日志已接入 Harlowe，四区界面从 T−2 出现。作者已明确授权本轮中文提纲试玩，正式英文另行填充。

src/story.twee 仍为唯一故事源。流程节点、内容节点与 Media 配置分开编辑；完整说明见 docs/story-skeleton.md。npm test 检查完整路线，npm run test:twine 检查桌面往返；npm run test:media 检查素材替换。旧 tests/offline.cjs 留作技术样例历史。

当前离线包为 releases/final-ip-story-skeleton-dev.zip，含开发标识，不可作为成品提交。实测记录见 evidence/tests/story-tests.json、twine-roundtrip.json、story-media-tests.json。
