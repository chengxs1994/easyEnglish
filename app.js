import {bindBatchImport} from './import-dialog.js?v=20261120-return-library';
import {BUNDLED_VIDEO_ID,fetchBundledVideo,selectStartupLesson} from './bundled-lessons.js';
import {formatTime,normalize,cloze,getVideoCaption,escapeHtml as esc} from './core.js';
/** 查找页面中的单个界面元素。 */
const $ = selector => document.querySelector(selector);
const media=$('#media');
const state={lesson:null,lessons:[],mode:'bilingual',active:0,blind:false,ab:null,segmentEnd:null,mastered:[],saved:[],answers:{},revealed:new Set(),db:null,url:null,recordUrl:null,recorder:null,stream:null,persistTimer:null};
/** 生成固定图标标记，保持播放器按钮的图标和文字结构一致。 */
function icon(name){return `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;}
/** 打开已有设置弹层，使用原生 dialog 管理焦点和 Escape 关闭。 */
function openSheet(id){const panel=$(`#${id}`);panel.hidden=false;if(!panel.open)panel.showModal();}
/** 关闭设置弹层，并保留关闭按钮的原生焦点恢复。 */
function closeSheet(id){const panel=$(`#${id}`);if(panel.open)panel.close();}
/** 仅在同一次点按从遮罩开始并在遮罩结束时关闭弹窗。 */
function bindDialogDismiss(panel){
 let pressedOutside=false;
 /** 用视口坐标判断指针是否位于弹窗边框之外。 */
 const isOutside=event=>{const box=panel.getBoundingClientRect();return event.clientX<box.left||event.clientX>=box.right||event.clientY<box.top||event.clientY>=box.bottom;};
 panel.addEventListener('pointerdown',event=>{pressedOutside=event.isPrimary&&event.button===0&&event.target===panel&&isOutside(event);});
 panel.addEventListener('click',event=>{
  const dismiss=pressedOutside&&event.target===panel&&isOutside(event);
  pressedOutside=false;
  if(dismiss)panel.close();
 });
 panel.addEventListener('pointercancel',()=>{pressedOutside=false;});
 panel.addEventListener('close',()=>{pressedOutside=false;});
}
/** 更新底部工具标签，不销毁图标或选中状态。 */
function dockLabel(selector,label,accessibleLabel){const button=$(selector);button.lastElementChild.textContent=label;if(accessibleLabel)button.setAttribute('aria-label',accessibleLabel);}
/** 同步舞台与底部的播放状态，保留一致的图标。 */
function refreshPlayback(){const playing=!media.paused;$('.media-shell').classList.toggle('playing',playing);$('#play').innerHTML=`<span class="play-circle">${icon(playing?'pause':'play')}</span><span class="play-label">${playing?'暂停':'播放'}</span>`;$('#play').setAttribute('aria-label',playing?'暂停':'播放');$('#stage-play').innerHTML=icon(playing?'pause':'play');$('#stage-play').setAttribute('aria-label',playing?'暂停视频或音频':'播放视频或音频');}
/** 按手动开关将当前句叠加到视频画面，练习隐藏规则仍由字幕模式控制。 */
function refreshVideoCaptions(){
 const layer=$('#video-captions');
 const caption=$('#video-subtitles').checked&&state.lesson&&!state.lesson.demo&&!state.lesson.mediaType?.startsWith('audio/')
  ?getVideoCaption(state.lesson.cues,media.currentTime||0,{mode:state.mode,blind:state.blind,paused:media.paused}):null;
 layer.hidden=!caption;
 $('#video-caption-en').textContent=caption?.en||'';
 $('#video-caption-zh').textContent=caption?.zh||'';
 $('#video-caption-zh').hidden=!caption?.zh;
}
/** 同步播放时间、进度条和倍速读数。 */
function refreshTimeline(){const duration=Number.isFinite(media.duration)?media.duration:0;const current=media.currentTime||0;$('#elapsed').textContent=formatTime(current);$('#duration').textContent=formatTime(duration);$('#seek').max=duration||100;$('#seek').value=current;$('#seek').style.setProperty('--seek-percent',`${duration?current/duration*100:0}%`);$('#speed-display').textContent=`${media.playbackRate.toFixed(2).replace(/0$/,'')}x`;}
/** 收藏或掌握当前句，并保存变化。 */
function toggleCurrent(kind){if(!state.lesson)return;const list=kind==='saved'?state.saved:state.mastered;const index=list.indexOf(state.active);if(index<0)list.push(state.active);else list.splice(index,1);renderCues();persist();}
/** 显示可读的临时状态消息。 */
function toast(message){const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.hidden=true,4500);}
/** 打开本机资料库；视频 Blob 和字幕保存在同一数据库。 */
function openDatabase(){return new Promise((resolve,reject)=>{const req=indexedDB.open('listening-room',1);req.onupgradeneeded=()=>req.result.createObjectStore('lessons',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
/** 等待数据库事务提交，确保成功提示对应真正落盘。 */
function transaction(action,mode='readonly'){return new Promise((resolve,reject)=>{const tx=state.db.transaction('lessons',mode);let result;const req=action(tx.objectStore('lessons'));req.onsuccess=()=>result=req.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
/** 保存当前学习状态；失败时保留页面数据并明确反馈。 */
async function persist(){if(!state.lesson||!state.db)return;Object.assign(state.lesson,{mastered:state.mastered,saved:state.saved,position:media.currentTime||0,answers:state.answers});try{await transaction(store=>store.put(state.lesson),'readwrite');const index=state.lessons.findIndex(item=>item.id===state.lesson.id);if(index>=0)state.lessons[index]=state.lesson;renderLibrary();}catch{toast('保存失败，浏览器空间可能不足。请先导出学习记录。');}}
/** 获取资料列表并更新资料切换按钮。 */
async function refreshLibrary(){state.lessons=await transaction(store=>store.getAll());renderLibrary();}
/** 渲染资料列表，避免使用用户数据生成未转义的 HTML。 */
function renderLibrary(){$('#library').innerHTML=state.lessons.length?state.lessons.map(l=>`<div class="library-item ${l.id===state.lesson?.id?'active':''}"><button data-lesson="${esc(l.id)}">${esc(l.title)}<small>${l.cues.length} 句 · 已掌握 ${(l.mastered||[]).length} 句${l.demo||l.bundled?' · 示例':''}</small></button></div>`).join(''):'<p class="muted">还没有导入资料，先从示例开始。</p>';}
/** 无课程时禁用需要字幕的操作，保留资料库、导入和主题入口。 */
function setLessonControls(enabled){
 for(const id of ['play','previous','next','save-current','master-current','blind','ab','practice-open','speed','seek','export','original','record'])$(`#${id}`).disabled=!enabled;
 document.querySelectorAll('[data-mode]').forEach(button=>button.disabled=!enabled);
}
/** 首次克隆不含媒体文件时显示可操作的导入空状态。 */
function showEmptyLibrary(){
 setLessonControls(false);$('#stage-play').hidden=true;$('#media-badge').hidden=true;$('#demo').disabled=true;
 $('#lesson-title').textContent='导入你的第一份学习资料';
 $('.audio-art p').innerHTML='Your own<br>listening room.';
 $('.audio-caption').textContent='选择视频和字幕，即可开始练习';
 $('#cues').innerHTML='<div class="empty">还没有学习资料。<br>点击右上角「＋」导入视频与字幕，<br>也可以从资料库批量导入文件夹。</div>';
 $('#source-note').textContent='开源版本不附带第三方视频，请导入有权使用的本地资料。';
}
/** 载入资料并恢复字幕、练习答案和上次播放位置。 */
async function loadLesson(lesson){
 if(!lesson){showEmptyLibrary();return;}
 setLessonControls(true);$('#stage-play').hidden=false;$('#media-badge').hidden=false;$('#demo').disabled=!state.lessons.some(item=>item.id===BUNDLED_VIDEO_ID);
 if(state.lesson)await persist();
 if(state.recorder?.state==='recording')stopRecording();
 media.pause(); if(state.url)URL.revokeObjectURL(state.url);if(state.recordUrl)URL.revokeObjectURL(state.recordUrl);
 state.recordUrl=null;$('#record-play').disabled=true;$('#recording').hidden=true;$('#recording').removeAttribute('src');
 state.lesson=lesson;state.active=0;state.mastered=lesson.mastered||[];state.saved=lesson.saved||[];state.answers=lesson.answers||{};state.revealed=new Set();state.ab=null;state.segmentEnd=null;state.blind=false;
 dockLabel('#blind','盲听','盲听');$('#blind').setAttribute('aria-pressed','false');$('#blind-banner').hidden=true;closeSheet('ab-panel');$('#ab-panel').hidden=true;$('#ab').setAttribute('aria-pressed','false');dockLabel('#ab','复读','设置 AB 复读');
 state.url=lesson.blob?URL.createObjectURL(lesson.blob):null;
 media.src=state.url||lesson.mediaUrl||'assets/demo.mp3';media.load();
 const audio=lesson.demo||lesson.mediaType?.startsWith('audio/');$('.media-shell').classList.toggle('is-audio',audio);$('#audio-art').hidden=!audio;$('#media-badge').textContent=lesson.bundled?'示例视频':lesson.demo?'示例音频':audio?'本地音频':'本地视频';
 $('#lesson-title').textContent=lesson.title;$('#source-note').textContent=lesson.id===BUNDLED_VIDEO_ID?'随项目附带的《当幸福来敲门》片段，中文字幕为网站机翻。':lesson.bundled?'随项目附带的学习视频。':lesson.demo?'示例为本机合成的英文朗读，可立即开始练习。':'视频和字幕已保存在当前浏览器，刷新后可以继续学习。';
 $('#cue-count').textContent=`${lesson.cues.length} 句`;$('.audio-art p').innerHTML=lesson.demo?'Small habits.<br>Real progress.':'Your own<br>listening room.';$('.audio-caption').textContent=lesson.demo?'从小习惯开始 · 英语朗读':'本地音频 · 逐句精听';refreshPlayback();
 media.onloadedmetadata=()=>{refreshTimeline();media.currentTime=Math.min(lesson.position||0,Number.isFinite(media.duration)?Math.max(0,media.duration-.1):0);updateActive();};
 const options=lesson.cues.map((cue,i)=>`<option value="${i}">${i+1}. ${formatTime(cue.start)} ${esc(cue.en.slice(0,32))}</option>`).join('');$('#ab-start').innerHTML=options;$('#ab-end').innerHTML=options;
 renderCues();renderLibrary();localStorage.setItem('listening-room-current',lesson.id);
}
/** 更新掌握统计和当前句跟读文本。 */
function updateProgress(){$('#progress-label').textContent=`已掌握 ${state.mastered.length} / ${state.lesson.cues.length} 句`;$('#progress').max=state.lesson.cues.length;$('#progress').value=state.mastered.length;$('#practice-text').textContent=state.blind?'先专注听，结束盲听后再跟读。':state.lesson.cues[state.active]?.en||'';$('#saved-count').textContent=state.saved.length;$('#save-current').setAttribute('aria-pressed',state.saved.includes(state.active));$('#save-current').setAttribute('aria-label',state.saved.includes(state.active)?'取消收藏当前句':'收藏当前句');$('#master-current').innerHTML=icon('check')+(state.mastered.includes(state.active)?'已掌握':'标记掌握');}
/** 根据模式生成字幕卡片，听写输入保留在当前资料中。 */
function renderCues(){
 if(!state.lesson)return;
 const help={bilingual:'点击字幕播放本句',english:'只看英文，听完再用双语核对。',cloze:'听原音回忆缺词，点击空白揭示答案。',dictation:'听原音后写下整句。按 Enter 检查，Shift + Enter 换行。',saved:'收藏的句子集中在这里，适合反复练习。'};
 $('#mode-help').textContent=help[state.mode];
 const list=state.lesson.cues.map((cue,i)=>({cue,i})).filter(({i})=>state.mode!=='saved'||state.saved.includes(i));
 $('#cues').innerHTML=list.length?list.map(({cue,i})=>{
  const target=cloze(cue.en);let sentence=`<button class="sentence-play" data-play="${i}" aria-label="播放第 ${i+1} 句：${esc(cue.en)}">${esc(cue.en)}</button>`;
  if(state.mode==='cloze'&&target)sentence=`<p class="sentence">${esc(target.before)}<button class="cloze-word" data-reveal="${i}" aria-label="揭示第 ${i+1} 句的缺词">${state.revealed.has(i)?esc(target.answer):'______'}</button>${esc(target.after)}</p>`;
  if(state.mode==='dictation')sentence=`<label class="dictation-label" for="answer-${i}">第 ${i+1} 句：听原音，写下完整句子</label><textarea id="answer-${i}" class="dictation-input" data-answer="${i}" rows="2" spellcheck="false" autocomplete="off" placeholder="在这里输入听到的英文">${esc(state.answers[i]||'')}</textarea><div class="button-row"><button data-check="${i}">检查答案</button><button data-solution="${i}">查看原文</button></div><p class="feedback" id="feedback-${i}" role="status"></p>`;
  return `<article class="cue ${i===state.active?'active':''}" data-cue="${i}" aria-label="第 ${i+1} 句">${sentence}${['bilingual','saved'].includes(state.mode)&&cue.zh?`<p class="translation">${esc(cue.zh)}</p>`:''}<div class="cue-bottom"><span class="cue-time">#${i+1}　${formatTime(cue.start)} — ${formatTime(cue.end)}</span><div class="cue-actions"><button data-save="${i}" class="${state.saved.includes(i)?'saved':''}" aria-label="${state.saved.includes(i)?'取消收藏':'收藏'}第 ${i+1} 句" aria-pressed="${state.saved.includes(i)}">${icon('star')}</button><button data-copy="${i}" aria-label="复制第 ${i+1} 句">${icon('copy')}</button><button data-play="${i}" aria-label="播放第 ${i+1} 句原音">${icon('note')}</button><button data-practice="${i}" aria-label="跟读第 ${i+1} 句">${icon('mic')}</button><button data-master="${i}" class="${state.mastered.includes(i)?'mastered':''}" aria-label="${state.mastered.includes(i)?'取消掌握':'标记掌握'}第 ${i+1} 句" aria-pressed="${state.mastered.includes(i)}">${icon('check')}</button></div></div></article>`;
 }).join(''):'<div class="empty">还没有收藏句子。<br>点击字幕卡片右上角的 ☆ 即可收藏。</div>';
 $('#cues').hidden=state.blind;updateProgress();refreshVideoCaptions();
}
/** 播放媒体并在浏览器拒绝或格式不兼容时显示反馈。 */
async function play(){try{await media.play();}catch{toast('无法播放，请确认文件格式受浏览器支持，或重新导入 MP4 / MP3。');}}
/** 从指定句起点播放，并在句末停止。 */
function playCue(index){if(!state.lesson)return;const cue=state.lesson.cues[Math.max(0,Math.min(index,state.lesson.cues.length-1))];state.segmentEnd=cue.end;media.currentTime=cue.start;updateActive();play();}
/** 根据媒体时间更新高亮；仅滚动字幕容器，不移动整个页面。 */
function updateActive(){refreshVideoCaptions();if(!state.lesson)return;const t=media.currentTime;let index=state.lesson.cues.findIndex(c=>t>=c.start&&t<c.end);if(index<0)index=state.lesson.cues.findLastIndex(c=>t>=c.start);index=Math.max(0,index);if(index!==state.active){state.active=index;document.querySelectorAll('[data-cue]').forEach(el=>el.classList.toggle('active',+el.dataset.cue===index));updateProgress();if($('#follow').checked&&!state.blind){const row=$(`[data-cue="${index}"]`),box=$('#cues');if(row)box.scrollTo({top:row.offsetTop-8,behavior:'smooth'});}}}
/** 检查整句听写，输出文字正误说明。 */
function checkAnswer(index){const feedback=$(`#feedback-${index}`);const answer=state.answers[index]||'';const ok=normalize(answer)===normalize(state.lesson.cues[index].en);feedback.className=`feedback ${ok?'correct':'incorrect'}`;feedback.textContent=answer.trim()?(ok?'✓ 回答正确。再试着跟读一遍。':'✕ 还不完全正确。再听一遍，或点击「查看原文」核对。'):'请先输入听到的英文。';persist();}
/** 开始或结束本地录音，关闭弹窗或切课后丢弃尚未返回的权限请求。 */
async function toggleRecording(){
 if(state.recorder?.state==='recording'){stopRecording();return;}
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){toast('当前浏览器不支持录音，请使用 Chrome 打开本地地址。');return;}
 const panel=$('#practice-dialog'),recordedLesson=state.lesson.id;
 let cancelled=false;
 // 只取消本次权限请求，防止关闭后重新打开弹窗时启动旧请求。
 const cancelPending=()=>{cancelled=true;};
 panel.addEventListener('close',cancelPending,{once:true});
 media.pause();$('#record').disabled=true;
 try{
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  if(cancelled||!panel.open||state.lesson.id!==recordedLesson){stream.getTracks().forEach(track=>track.stop());return;}
  state.stream=stream;const recorder=new MediaRecorder(stream);state.recorder=recorder;const chunks=[];
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
  recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());if(state.lesson.id!==recordedLesson)return;if(state.recordUrl)URL.revokeObjectURL(state.recordUrl);state.recordUrl=URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType}));$('#recording').src=state.recordUrl;$('#recording').hidden=false;$('#record-play').disabled=false;$('#record-state').textContent='录音已就绪，可以回放比较';};
  recorder.start();$('#record').innerHTML=icon('mic')+'<span>停止录音</span>';$('#record-state').textContent='正在录音，完成后点击停止';
 }catch(error){stopRecording();if(!cancelled&&panel.open&&state.lesson.id===recordedLesson)toast(error.name==='NotAllowedError'?'麦克风权限未开启。允许本机页面使用麦克风后可重试。':'无法开启麦克风，请检查是否连接或被其他程序占用。');}
 finally{panel.removeEventListener('close',cancelPending);$('#record').disabled=false;}
}
/** 停止录音并及时释放麦克风。 */
function stopRecording(){if(state.recorder?.state==='recording')state.recorder.stop();state.stream?.getTracks().forEach(track=>track.stop());state.stream=null;$('#record').innerHTML=icon('mic')+'<span>开始录音</span>';}
/** 以下载方式备份双语字幕和 JSON 学习记录。 */
function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
/** 将资料时间轴转换成可重新导入的 SRT 字幕。 */
function subtitleTime(seconds){const ms=Math.round(seconds*1000);return `${Math.floor(ms/3600000).toString().padStart(2,'0')}:${Math.floor(ms/60000)%60}`.replace(/:(\d)$/ ,':0$1')+`:${(Math.floor(ms/1000)%60).toString().padStart(2,'0')},${(ms%1000).toString().padStart(3,'0')}`;}

$('#play').onclick=()=>{if(media.paused){state.segmentEnd=null;play();}else media.pause();};
$('#previous').onclick=()=>playCue(state.active-1);$('#next').onclick=()=>playCue(state.active+1);$('#original').onclick=()=>playCue(state.active);
$('#speed').onchange=()=>{media.playbackRate=+$('#speed').value;refreshTimeline();};
media.onplay=refreshPlayback;
media.onended=()=>{if(state.ab){media.currentTime=state.ab.start;play();}};
media.onpause=()=>{refreshPlayback();refreshVideoCaptions();persist();};
media.onseeked=()=>{updateActive();refreshVideoCaptions();};
media.onerror=()=>{if(state.lesson)toast('媒体加载失败。请重新导入浏览器支持的 MP4、WebM 或 MP3 文件。');};
media.ontimeupdate=()=>{
 refreshTimeline();const previousCue=state.lesson?.cues[state.active];const t=media.currentTime;updateActive();
 if(state.ab&&t>=state.ab.end){media.currentTime=state.ab.start;return;}
 const cue=previousCue;
 if(state.segmentEnd!==null&&t>=state.segmentEnd){state.segmentEnd=null;media.pause();}
 else if($('#sentence-stop').checked&&cue&&t>=cue.end&&t<cue.end+1&&!media.paused&&!state.ab)media.pause();
 if(!state.persistTimer)state.persistTimer=setTimeout(()=>{state.persistTimer=null;persist();},3000);
};
$('#cues').onclick=event=>{const button=event.target.closest('button');if(!button)return;
 if(button.dataset.play!==undefined)playCue(+button.dataset.play);
 if(button.dataset.copy!==undefined){const cue=state.lesson.cues[+button.dataset.copy];navigator.clipboard.writeText(cue.en+(cue.zh?'\n'+cue.zh:'')).then(()=>toast('已复制本句字幕。')).catch(()=>toast('无法复制，请选择句子手动复制。'));}
 if(button.dataset.practice!==undefined){media.pause();media.currentTime=state.lesson.cues[+button.dataset.practice].start;updateActive();openSheet('practice-dialog');}
 if(button.dataset.reveal!==undefined){state.revealed.add(+button.dataset.reveal);button.textContent=cloze(state.lesson.cues[+button.dataset.reveal].en).answer;}
 if(button.dataset.check!==undefined)checkAnswer(+button.dataset.check);
 if(button.dataset.solution!==undefined){const i=+button.dataset.solution;const el=$(`#feedback-${i}`);el.className='feedback';el.textContent=`原文：${state.lesson.cues[i].en}`;}
 if(button.dataset.save!==undefined||button.dataset.master!==undefined){const saving=button.dataset.save!==undefined;const i=+(saving?button.dataset.save:button.dataset.master);const list=saving?state.saved:state.mastered;const index=list.indexOf(i);if(index>=0)list.splice(index,1);else list.push(i);renderCues();renderLibrary();persist();}
};
$('#cues').oninput=event=>{if(event.target.dataset.answer!==undefined){state.answers[+event.target.dataset.answer]=event.target.value;clearTimeout(state.answerTimer);state.answerTimer=setTimeout(persist,400);}};
$('#cues').onkeydown=event=>{if(event.target.dataset.answer!==undefined&&event.key==='Enter'&&!event.shiftKey){event.preventDefault();checkAnswer(+event.target.dataset.answer);}};
document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{if(button.dataset.mode==='practice'){openSheet('practice-dialog');return;}state.mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(el=>el.setAttribute('aria-pressed',el===button));renderCues();});
$('#blind').onclick=()=>{state.blind=!state.blind;dockLabel('#blind',state.blind?'显示字幕':'盲听',state.blind?'显示字幕':'盲听');$('#blind').setAttribute('aria-pressed',state.blind);$('#cues').hidden=state.blind;$('#blind-banner').hidden=!state.blind;$('#practice-text').textContent=state.blind?'先专注听，结束盲听后再跟读。':state.lesson.cues[state.active].en;refreshVideoCaptions();};
$('#compact').onclick=()=>{const compact=$('.media-shell').classList.toggle('compact');$('#compact').setAttribute('aria-label',compact?'展开画面':'收起画面');$('#compact').setAttribute('aria-expanded',!compact);};
$('#ab').onclick=()=>openSheet('ab-panel');
$('#ab-start-play').onclick=()=>{const start=+$('#ab-start').value,end=+$('#ab-end').value;if(end<start){$('#ab-status').textContent='终点需要在起点之后，或选择同一句。';return;}state.ab={start:state.lesson.cues[start].start,end:state.lesson.cues[end].end};state.segmentEnd=null;$('#ab-status').textContent=`正在复读第 ${start+1} 至 ${end+1} 句（${formatTime(state.ab.start)} 至 ${formatTime(state.ab.end)}）`;$('#ab').setAttribute('aria-pressed','true');dockLabel('#ab','复读中',`正在复读第 ${start+1} 至 ${end+1} 句，打开复读设置`);media.currentTime=state.ab.start;play();};
$('#ab-clear').onclick=()=>{state.ab=null;state.segmentEnd=null;media.pause();$('#ab-status').textContent='复读已停止';$('#ab').setAttribute('aria-pressed','false');dockLabel('#ab','复读','设置 AB 复读');};
$('#record').onclick=toggleRecording;
$('#record-play').onclick=()=>{$('#recording').play().catch(()=>toast('无法回放，请重新录音。'));};
$('#import-open').onclick=()=>openSheet('import-dialog');$('#import-close').onclick=()=>$('#import-dialog').close();
bindBatchImport({
 getLessons:()=>state.lessons,
 isReady:()=>!!state.db,
 saveLesson:async lesson=>{await transaction(store=>store.add(lesson),'readwrite');state.lessons.push(lesson);},
 onComplete:()=>refreshLibrary(),
 onViewLibrary:()=>{closeSheet('import-dialog');openSheet('library-dialog');}
});
$('#library').onclick=async event=>{const button=event.target.closest('[data-lesson]');if(!button)return;try{const lesson=await transaction(store=>store.get(button.dataset.lesson));if(lesson){await loadLesson(lesson);closeSheet('library-dialog');}}catch{toast('无法读取资料，请刷新后重试。');}};
$('#demo').onclick=async()=>{try{const demo=await transaction(store=>store.get(BUNDLED_VIDEO_ID));await loadLesson(demo);closeSheet('library-dialog');}catch{toast('无法读取示例资料。');}};
$('#export').onclick=async()=>{await persist();const l=state.lesson;const text=l.cues.map((c,i)=>`${i+1}\n${subtitleTime(c.start)} --> ${subtitleTime(c.end)}\n${c.en}${c.zh?'\n'+c.zh:''}`).join('\n\n');download(l.title+'.srt',text,'text/plain;charset=utf-8');const {blob,...backup}=l;download(l.title+'.json',JSON.stringify({version:1,...backup},null,2),'application/json');toast('已导出字幕和学习记录；原视频请保留自己的文件。');};
document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]')||event.ctrlKey||event.metaKey||event.altKey||event.target.closest('input,textarea,select,button,a,summary'))return;if(event.code==='Space'){event.preventDefault();$('#play').click();}if(event.key==='ArrowLeft'){event.preventDefault();playCue(state.active-1);}if(event.key==='ArrowRight'){event.preventDefault();playCue(state.active+1);}});
$('#stage-play').onclick=()=>$('#play').click();
$('#seek').oninput=()=>{if(!Number.isFinite(media.duration))return;state.segmentEnd=null;media.currentTime=Math.min(media.duration,Math.max(0,+$('#seek').value));refreshTimeline();updateActive();};
$('#library-open').onclick=()=>openSheet('library-dialog');
$('#directory-open').onclick=()=>openSheet('library-dialog');
$('#practice-open').onclick=()=>openSheet('practice-dialog');
$('#more-open').onclick=()=>openSheet('more-dialog');
// 画面字幕仅在本次页面内手动开启，刷新后恢复关闭。
$('#video-subtitles').checked=false;
$('#video-subtitles').onchange=refreshVideoCaptions;
$('#library-import').onclick=()=>{closeSheet('library-dialog');openSheet('import-dialog');};
$('#more-import').onclick=()=>{closeSheet('more-dialog');openSheet('import-dialog');};
$('#save-current').onclick=()=>toggleCurrent('saved');
$('#master-current').onclick=()=>toggleCurrent('mastered');
$('#saved-open').onclick=()=>document.querySelector('[data-mode="saved"]').click();
$('#blind-exit').onclick=()=>$('#blind').click();
document.querySelectorAll('dialog').forEach(bindDialogDismiss);
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
// 原生关闭和 Escape 都会释放麦克风，并停止已录音频的回放。
$('#practice-dialog').addEventListener('close',()=>{stopRecording();$('#recording').pause();});
media.ondurationchange=refreshTimeline;
document.addEventListener('visibilitychange',()=>{if(document.hidden)persist();});
/** 初始化每个浏览器的资料库，并从项目静态文件注册随附视频。 */
async function init(){
 try{
  state.db=await openDatabase();
  let bundled=await transaction(store=>store.get(BUNDLED_VIDEO_ID));
  if(!bundled){
   bundled=await fetchBundledVideo(fetch);
   if(bundled)await transaction(store=>store.put(bundled),'readwrite');
  }
  await refreshLibrary();
  const previous=localStorage.getItem('listening-room-current');
  await loadLesson(selectStartupLesson(state.lessons,previous));
 }catch{
  toast('无法载入本地资料，请确认服务正在运行，并允许此页面存储资料。');
  $('#cues').innerHTML='<div class="empty">资料暂不可用。请刷新页面，或重新启动本地服务。</div>';
 }
}
init();
