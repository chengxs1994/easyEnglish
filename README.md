# 易英语 · easyEnglish

本地优先的英语精听工具。把自己的视频和字幕，变成可以逐句播放、复读、跟读和听写的学习资料。

**在线体验：[listen.xsaiai.top](https://listen.xsaiai.top/)** · **许可证：[MIT](LICENSE)**

Local-first English listening practice with bilingual subtitles, sentence replay, shadowing, dictation, and batch imports. No account or API key required. Your imported files and learning progress stay in your browser.

## 功能

- **双语字幕与逐句播放**：点击字幕播放本句，支持倍速、AB 复读和句末暂停。
- **跟读与听写**：本机录音、录音回放、挖空与整句听写。
- **批量导入**：一次选择 MP4 与 SRT / VTT，或选择包含多级子目录的文件夹。
- **自动匹配与预览**：按同目录同名匹配，允许修改课程名、手动配字幕、勾选后导入。
- **本机学习记录**：收藏句子、掌握标记、听写答案和播放位置保存在当前浏览器。
- **浅色与深色**：首次跟随系统，手动切换后记住选择；支持电脑和手机布局。

## 快速开始

需要 **Node.js 22 或更新版本**。没有第三方运行依赖，无需 `npm install`。

```sh
git clone https://github.com/chengxs1994/easyEnglish.git
cd easyEnglish
npm start
```

打开 [http://127.0.0.1:8765/](http://127.0.0.1:8765/)。终端需保持运行，按 Ctrl+C 停止。

macOS 也可以在项目目录执行 `./start.command`。服务默认只监听本机回环地址。

## 导入与学习

1. 点击顶部 **＋**，同时选择自己的视频和字幕，或选择整个文件夹。
2. 核对匹配清单，按需修改名称、切换字幕和勾选项目。
3. 确认导入后，自动回到资料库列表，点击课程开始学习。
4. 点击字幕逐句练习，或用底部播放按钮连续播放。

自动匹配优先选择**同目录、同文件名**的媒体与字幕。同目录只有一个媒体和一个字幕时，即使名称不同也会配对。多个字幕有歧义时，请手动选择。不同目录的同名文件分别处理。

重复判断依据是媒体文件名、大小、修改时间和解析字幕，不读取整个视频做内容哈希。重复项默认跳过，不覆盖已有学习记录。保存失败的项目保留在清单中，成功项目不会回滚；空间不足会停止后续导入。

目录选择取决于浏览器和系统文件选择器，手机无法选择目录时可使用多文件选择。MP4、WebM、MP3 等能否播放，还取决于浏览器支持的编码。

## 双语字幕格式

英文与中文放在同一时间段中，示例见 [assets/example.srt](assets/example.srt)：

```srt
1
00:00:01,000 --> 00:00:04,000
Small steps make a difference.
小小的行动，也能带来改变。
```

支持只有英文的字幕。字幕时间轴应与视频一致。画面内字幕默认关闭，可从 **更多 → 画面字幕** 手动开启。

## 数据与隐私

- 视频、字幕和学习记录保存在当前浏览器的 IndexedDB，不上传到服务器。
- 主题偏好与最近课程保存在当前站点的 localStorage。
- 跟读录音仅保留在本次页面中，刷新后丢弃；录音不上传、不评分。
- 换浏览器、设备、域名或端口不会自动共享资料；清理网站数据会删除本机记录。
- 请保留原视频，并使用资料库中的 **导出字幕与学习记录** 下载 SRT 与 JSON 备份。当前未提供 JSON 备份的一键恢复功能。

录音需要允许麦克风权限；远程部署请使用 HTTPS。本地 `localhost` / `127.0.0.1` 可用于开发。

## 素材与部署

**仓库不包含第三方电影、访谈视频、配套字幕或下载脚本。** 首次克隆显示导入空状态，导入自己的资料即可使用。MIT 许可证只适用于仓库源码及明确附带的原创示例，不授予任何第三方素材的使用权。

项目是原生 HTML / CSS / JavaScript，可部署到支持 HTTPS 的静态站点。根目录的 HTML、CSS、JS 与 `assets/icon.svg` 是运行文件；`server.mjs` 仅用于本机预览。个人导入的资料由访客浏览器保存，服务器无需接收视频上传。

当前没有自动转写、自动翻译、AI 发音评分、账号或跨设备同步。

## 开发与测试

```sh
npm test
node --check app.js
node --check server.mjs
```

主要模块：

| 文件 | 职责 |
|---|---|
| `app.js` | 播放、学习模式、录音与 IndexedDB 资料库 |
| `batch-import.js` | 批量匹配、字幕检查、重复识别与逐项保存 |
| `import-dialog.js` | 导入清单、手动配对与交互状态 |
| `core.js` | 字幕解析、时间处理、听写比较与安全转义 |
| `theme.js` | 系统主题、手动切换与主题记忆 |
| `server.mjs` | 无依赖本机静态服务与视频 Range 请求 |

历史版本内部使用的 `listening-room` 存储键保留，以兼容已有学习记录。

## License

[MIT](LICENSE) © 2026 chengxs1994
