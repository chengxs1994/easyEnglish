import test from 'node:test';
import assert from 'node:assert/strict';
import * as batch from '../batch-import.js';

/** 创建带相对路径的 File 替身，字幕读取行为与浏览器一致。 */
function file(path, text = '', extras = {}) {
  return {name: path.split('/').at(-1), webkitRelativePath: path.includes('/') ? path : '', size: 123, lastModified: 456, text: async () => text, ...extras};
}
const subtitle = '1\n00:00:00,000 --> 00:00:02,000\nHello there.\n你好。';

test('同目录同名优先于其他语言字幕，不跨目录串课', () => {
  const files = [file('root/a/lesson.mp4'), file('root/a/lesson.srt'), file('root/a/lesson.en.srt'), file('root/b/lesson.mp4'), file('root/b/other.srt')];
  const plan = batch.matchImportFiles(files);
  assert.deepEqual(plan.rows.map(r => r.subtitleIndex), [1, 4]);
  assert.deepEqual(plan.rows.map(r => r.title), ['a · lesson', 'b · lesson']);
});

test('仅在同目录只有一媒体一字幕时回退；多字幕或多媒体保持待选', () => {
  const plan = batch.matchImportFiles([file('a/a.mp4'), file('a/b.srt'), file('b/a.mp4'), file('b/en.srt'), file('b/zh.srt'), file('c/a.mp4'), file('c/b.mp4'), file('c/one.srt')]);
  assert.deepEqual(plan.rows.map(r => r.subtitleIndex), [1, -1, -1, -1]);
});

test('字幕候选可手动跨目录选；孤立字幕和不支持文件有计数', () => {
  const plan = batch.matchImportFiles([file('a/video.mp4'), file('b/video.srt'), file('notes.txt')]);
  assert.equal(plan.rows[0].subtitleIndex, -1);
  assert.equal(plan.subtitles.length, 1);
  assert.equal(plan.ignored, 1);
  assert.equal(plan.unmatchedSubtitles.length, 1);
});

test('文件扩展名大小写和 Unicode 规范形式可匹配，重复选择同文件不重复列出', () => {
  const video = file('a/Café.MP4');
  const plan = batch.matchImportFiles([video, video, file('a/Cafe\u0301.SRT')]);
  assert.equal(plan.rows.length, 1);
  assert.equal(plan.rows[0].subtitleIndex, 1);
});

test('精确同名字幕有多个候选时不擅自选取', () => {
  const plan = batch.matchImportFiles([file('a/a.mp4'), file('a/a.srt'), file('a/a.vtt')]);
  assert.equal(plan.rows[0].subtitleIndex, -1);
});

test('读取有效字幕，错误字幕逐项报错，不静默进入资料库', async () => {
  const checked = await batch.readImportSubtitle(file('a.srt', subtitle));
  assert.equal(checked.cues.length, 1);
  assert.equal(checked.cues[0].zh, '你好。');
  await assert.rejects(batch.readImportSubtitle(file('bad.srt', 'not a subtitle')), /没有找到有效字幕/);
  await assert.rejects(batch.readImportSubtitle(file('huge.srt', '', {size: 11 * 1024 * 1024})), /10 MB/);
});

test('重复由媒体元信息和字幕共同判断，不因同名覆盖不同课程', async () => {
  const media = file('lesson.mp4');
  const {cues} = await batch.readImportSubtitle(file('lesson.srt', subtitle));
  const key = batch.importKey(media, cues);
  assert.equal(key, batch.importKey({...media}, cues));
  assert.notEqual(key, batch.importKey({...media, size: 124}, cues));
  assert.notEqual(key, batch.importKey(media, [{...cues[0], en: 'Changed'}]));
  assert.equal(batch.importKey(null, cues), null);
});

/** 创建待保存条目，复用真实字幕解析结果。 */
async function queued(name) {
  const media = file(name);
  const {cues} = await batch.readImportSubtitle(file('lesson.srt', subtitle));
  return {media, cues, title: name, key: batch.importKey(media, cues), selected: true};
}

test('一条保存失败不撤销成功课程，重试只保存剩余项目', async () => {
  const rows = [await queued('one.mp4'), await queued('two.mp4'), await queued('three.mp4')];
  const keys = new Set();
  const saved = [];
  const first = await batch.saveImportRows(rows, async lesson => {
    if (lesson.title === 'two.mp4') throw new Error('write failed');
    saved.push(lesson);
  }, keys);
  assert.equal(first.added, 2);
  assert.equal(first.failed, 1);
  assert.deepEqual(rows.map(r => !!r.saved), [true, false, true]);
  const second = await batch.saveImportRows(rows, async lesson => saved.push(lesson), keys);
  assert.equal(second.added, 1);
  assert.equal(saved.length, 3);
  assert.equal(new Set(saved.map(l => l.id)).size, 3);
});

test('空间不足停止后续保存，并明确保留成功和未处理状态', async () => {
  const rows = [await queued('one.mp4'), await queued('two.mp4'), await queued('three.mp4')];
  const attempted = [];
  const result = await batch.saveImportRows(rows, async lesson => {
    attempted.push(lesson.title);
    if (attempted.length === 2) { const error = new Error('quota'); error.name = 'QuotaExceededError'; throw error; }
  }, new Set());
  assert.equal(result.stopped, true);
  assert.equal(result.added, 1);
  assert.equal(result.failed, 1);
  assert.equal(attempted.length, 2);
  assert.match(rows[2].lastError, /尚未处理/);
  assert.equal(rows[0].saved, true);
});
