import {parseSubtitles} from './core.js';

/** 保留目录边界，使用浏览器提供的相对路径展示文件来源。 */
function filePath(file) { return (file.webkitRelativePath || file.name).normalize('NFC'); }
/** 提取不含扩展名的文件名，用于严格同名匹配。 */
function stem(path) { return path.split('/').at(-1).replace(/\.[^.]+$/, ''); }
/** 区分本机支持的媒体和时间轴字幕，不读取媒体内容。 */
function kind(file) {
  const extension = file.name.split('.').at(-1).toLowerCase();
  if (['srt', 'vtt'].includes(extension)) return 'subtitle';
  return ['mp4', 'webm', 'mov', 'm4v', 'mp3', 'm4a', 'wav', 'ogg', 'aac'].includes(extension) ? 'media' : 'other';
}
/** 按同目录同名优先、单媒体单字幕回退生成可确认的导入清单。 */
export function matchImportFiles(files) {
  const seen = new Set();
  const entries = [...files].filter(file => {
    const key = JSON.stringify([filePath(file), file.size, file.lastModified]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).map((file, index) => ({file, index, path: filePath(file), directory: filePath(file).split('/').slice(0, -1).join('/'), kind: kind(file)}));
  const media = entries.filter(item => item.kind === 'media').sort((a, b) => a.path.localeCompare(b.path, 'zh-CN', {numeric: true}));
  const subtitles = entries.filter(item => item.kind === 'subtitle').sort((a, b) => a.path.localeCompare(b.path, 'zh-CN', {numeric: true}));
  const rows = media.map(item => {
    const nearby = subtitles.filter(sub => sub.directory === item.directory);
    const exact = nearby.filter(sub => stem(sub.path).toLowerCase() === stem(item.path).toLowerCase());
    const selected = exact.length === 1 ? exact[0] : exact.length === 0 && nearby.length === 1 && media.filter(video => video.directory === item.directory).length === 1 ? nearby[0] : null;
    const name = stem(item.path);
    const repeated = media.filter(video => stem(video.path).toLowerCase() === name.toLowerCase()).length > 1;
    return {media: item.file, path: item.path, title: repeated && item.directory ? `${item.directory.split('/').at(-1)} · ${name}` : name, subtitleIndex: selected?.index ?? -1};
  });
  return {rows, subtitles, ignored: entries.filter(item => item.kind === 'other').length, unmatchedSubtitles: subtitles.filter(sub => !rows.some(row => row.subtitleIndex === sub.index))};
}
/** 校验字幕后返回时间轴；限制文本体积，避免误选巨大文件冻结页面。 */
export async function readImportSubtitle(file) {
  if (file.size > 10 * 1024 * 1024) throw new Error('字幕超过 10 MB，请检查是否选错文件。');
  return {cues: parseSubtitles(await file.text())};
}
/** 用媒体元信息和解析字幕识别重复；不以标题覆盖课程，也不读取大视频做哈希。 */
export function importKey(media, cues) {
  if (!media?.name || !Number.isFinite(media.size) || !Number.isFinite(media.lastModified)) return null;
  return JSON.stringify([media.name, media.size, media.lastModified, cues]);
}

/** 逐项保存可重试清单；不覆盖旧资料，空间不足时保留已成功和未处理项目。 */
export async function saveImportRows(rows, saveLesson, knownKeys, onProgress = () => {}) {
  const result = {added: 0, failed: 0, skipped: 0, stopped: false};
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.saved || knownKeys.has(row.key)) { row.selected = false; result.skipped++; continue; }
    onProgress(index + 1, rows.length);
    row.lastError = '';
    try {
      await saveLesson({id: crypto.randomUUID(), title: row.title.trim() || row.media.name.replace(/\.[^.]+$/, ''), blob: row.media, mediaType: row.media.type || (row.media.name.toLowerCase().endsWith('.mp4') ? 'video/mp4' : /\.(mp3|m4a|wav|ogg|aac)$/i.test(row.media.name) ? 'audio/' : 'video/'), cues: row.cues, mastered: [], saved: [], answers: {}, position: 0, createdAt: Date.now()});
      row.saved = true; row.selected = false; knownKeys.add(row.key); result.added++;
    } catch (failure) {
      result.failed++;
      row.lastError = failure.name === 'QuotaExceededError' ? '空间不足，本条未导入。请释放浏览器空间后重试。' : '保存失败，本条未导入，可重新尝试。';
      if (failure.name === 'QuotaExceededError') {
        rows.slice(index + 1).forEach(item => { item.lastError = '尚未处理：浏览器空间不足'; });
        result.stopped = true; break;
      }
    }
  }
  return result;
}
