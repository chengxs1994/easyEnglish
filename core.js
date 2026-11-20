/** 将 SRT / VTT 时间戳转换成秒，拒绝非法时间。 */
export function parseTime(value) {
  const match = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})$/);
  if (!match || +match[2] > 59 || +match[3] > 59) return NaN;
  return +(match[1] || 0) * 3600 + +match[2] * 60 + +match[3] + +match[4] / 1000;
}
/** 解析双语 SRT / VTT；中文行作为翻译，其余行作为原文。 */
export function parseSubtitles(input) {
  const blocks = input.replace(/^\uFEFF/, '').replace(/\r/g, '').trim().split(/\n\s*\n/);
  const cues = [];
  for (const block of blocks) {
    const lines = block.split('\n');
    const index = lines.findIndex(line => line.includes('-->'));
    if (index < 0) continue;
    const times = lines[index].split('-->');
    const start = parseTime(times[0]);
    const end = parseTime(times[1].trim().split(/\s/)[0]);
    const text = lines.slice(index + 1).map(line => line.replace(/<[^>]*>/g, '').trim()).filter(Boolean);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text.length) continue;
    const en = text.filter(line => !/[\u3400-\u9fff]/.test(line)).join(' ');
    const zh = text.filter(line => /[\u3400-\u9fff]/.test(line)).join(' ');
    cues.push({start, end, en: en || zh, zh: en ? zh : ''});
  }
  if (!cues.length) throw new Error('没有找到有效字幕。请导入带时间轴的 SRT 或 VTT 文件。');
  return cues.sort((a,b) => a.start - b.start);
}
/** 格式化播放器和字幕使用的时间。 */
export function formatTime(seconds) {
  const n = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(n / 60).toString().padStart(2,'0')}:${(n % 60).toString().padStart(2,'0')}`;
}
/** 忽略大小写、标点和多余空格，比较听写答案。 */
export function normalize(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[’‘]/g,"'").replace(/[^\p{L}\p{N}']/gu,' ').trim().replace(/\s+/g,' ');
}
/** 为句子选择较长的英文单词作为挖空目标。 */
export function cloze(text) {
  const words = [...text.matchAll(/\b[A-Za-z][A-Za-z']{3,}\b/g)];
  const word = words.sort((a,b) => b[0].length - a[0].length)[0];
  return word ? {before: text.slice(0,word.index), answer: word[0], after: text.slice(word.index + word[0].length)} : null;
}
/** 转义来自字幕和文件名的文本，避免插入 HTML。 */
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}

/** 按播放时间选择画面字幕；练习模式隐藏答案，句末暂停保留短暂的复习字幕。 */
export function getVideoCaption(cues, time, {mode = 'bilingual', blind = false, paused = false} = {}) {
  if (blind || mode === 'cloze' || mode === 'dictation') return null;
  const cue = cues.find(item => time >= item.start && time < item.end)
    || (paused ? cues.findLast(item => time >= item.end && time - item.end <= 0.5) : null);
  return cue ? {en: cue.en, zh: mode === 'english' ? '' : cue.zh || ''} : null;
}
