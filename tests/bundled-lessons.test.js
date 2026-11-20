import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BUNDLED_VIDEO_ID,createBundledVideo,selectStartupLesson} from '../bundled-lessons.js';
test('全新浏览器和仅有旧音频示例的浏览器默认打开当幸福来敲门',()=>{
 const video=createBundledVideo([{start:1,end:3,en:'Wow!',zh:'哇！'}]);
 const audio={id:'demo',demo:true};
 assert.equal(selectStartupLesson([audio,video],null).id,BUNDLED_VIDEO_ID);
 assert.equal(selectStartupLesson([audio,video],'demo').id,BUNDLED_VIDEO_ID);
 assert.equal(video.title,'当幸福来敲门：篮球与梦想');
 assert.equal(video.mediaUrl,'assets/default-happyness.mp4');
 assert.equal(video.mediaType,'video/mp4');
 assert.equal(video.blob,undefined);
});
test('旧默认视频切换到新示例，同时保留旧资料的学习记录',()=>{
 const previous={id:'bundled-reference-taylor-v1',bundled:true,position:24,saved:[2]};
 const video=createBundledVideo([]);
 assert.notEqual(video.id,previous.id);
 assert.equal(selectStartupLesson([previous,video],previous.id),video);
 assert.equal(previous.position,24);
 assert.deepEqual(previous.saved,[2]);
});
test('升级时保留用户导入资料及上次选择，不覆盖学习记录',()=>{
 const custom={id:'personal',position:24,saved:[2]};
 const video=createBundledVideo([]);
 assert.equal(selectStartupLesson([video,custom],'personal'),custom);
 assert.deepEqual(custom.saved,[2]);
});

test('开源版本不带素材时返回空资料，不影响导入入口启动', async()=>{
 const {fetchBundledVideo}=await import('../bundled-lessons.js');
 assert.equal(typeof fetchBundledVideo,'function');
 const lesson=await fetchBundledVideo(async()=>({ok:false,status:404}));
 assert.equal(lesson,null);
 assert.equal(selectStartupLesson([],null),undefined);
});
test('字幕存在但视频缺失时不注册不可播放的示例',async()=>{
 const {fetchBundledVideo}=await import('../bundled-lessons.js');
 const subtitle='1\n00:00:00,000 --> 00:00:02,000\nHello.\n你好。';
 const lesson=await fetchBundledVideo(async path=>path.endsWith('.srt')?{ok:true,status:200,text:async()=>subtitle}:{ok:false,status:404});
 assert.equal(lesson,null);
});
test('素材齐全时保留当前默认课程；服务错误不能被误报为无素材',async()=>{
 const {fetchBundledVideo}=await import('../bundled-lessons.js');
 const subtitle='1\n00:00:00,000 --> 00:00:02,000\nHello.\n你好。';
 const lesson=await fetchBundledVideo(async()=>({ok:true,status:200,text:async()=>subtitle}));
 assert.equal(lesson.id,BUNDLED_VIDEO_ID);
 assert.equal(lesson.cues.length,1);
 await assert.rejects(fetchBundledVideo(async()=>({ok:false,status:500})),/载入失败/);
});
