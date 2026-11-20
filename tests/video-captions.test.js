import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getVideoCaption} from '../core.js';
const cues=[{start:1,end:3,en:'Wow! -Yeah.',zh:'哇！——对啊。'},{start:5,end:8,en:'Oh, my Lord.',zh:'哦，天哪。'}];
test('视频按时间显示中英双语，并在空隙和句末清除旧字幕',()=>{
 assert.deepEqual(getVideoCaption(cues,1),{en:'Wow! -Yeah.',zh:'哇！——对啊。'});
 assert.deepEqual(getVideoCaption(cues,6),{en:'Oh, my Lord.',zh:'哦，天哪。'});
 assert.equal(getVideoCaption(cues,0),null);
 assert.equal(getVideoCaption(cues,3),null);
 assert.equal(getVideoCaption(cues,4),null);
 assert.deepEqual(getVideoCaption(cues,3.2,{paused:true}),{en:'Wow! -Yeah.',zh:'哇！——对啊。'});
 assert.equal(getVideoCaption(cues,4,{paused:true}),null);
});
test('盲听、挖空和听写不泄露答案；英文模式仅显示英文',()=>{
 assert.equal(getVideoCaption(cues,2,{blind:true}),null);
 assert.equal(getVideoCaption(cues,2,{mode:'cloze'}),null);
 assert.equal(getVideoCaption(cues,2,{mode:'dictation'}),null);
 assert.deepEqual(getVideoCaption(cues,2,{mode:'english'}),{en:'Wow! -Yeah.',zh:''});
});
