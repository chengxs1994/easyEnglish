import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseSubtitles,parseTime,normalize,cloze,escapeHtml} from '../core.js';
test('解析 BOM、CRLF、双语、多行原文及 VTT 设置', () => {
 const cues = parseSubtitles('\uFEFFWEBVTT\r\n\r\n00:01.000 --> 00:03.500 align:start\r\n<b>Hello</b> there.\r\n你好。\r\n\r\n2\r\n00:00:05,000 --> 00:00:08,000\r\nKeep going.\r\nOne step at a time.');
 assert.deepEqual(cues,[{start:1,end:3.5,en:'Hello there.',zh:'你好。'},{start:5,end:8,en:'Keep going. One step at a time.',zh:''}]);
});
test('忽略损坏时间和倒序时间轴；无有效字幕时明确失败',()=>{
 assert.ok(Number.isNaN(parseTime('00:91.000')));
 assert.throws(()=>parseSubtitles('1\n00:03.000 --> 00:01.000\nwrong'),/没有找到/);
});
test('听写容忍大小写、弯引号、标点与空白，保留词语差异',()=>{
 assert.equal(normalize('  It’s a NEW day! '),normalize("it's a new day"));
 assert.notEqual(normalize('new day'),normalize('new way'));
});
test('挖空能重建原句，不对短句编造目标',()=>{
 const text='Small steps make progress.'; const parts=cloze(text);
 assert.equal(parts.before+parts.answer+parts.after,text); assert.equal(cloze('I am.'),null);
});
test('字幕文本不能插入可执行标签',()=>assert.equal(escapeHtml('<img src="x">'),'&lt;img src=&quot;x&quot;&gt;'));
