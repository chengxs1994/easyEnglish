import {matchImportFiles, readImportSubtitle, importKey, saveImportRows} from './batch-import.js';
import {escapeHtml as esc} from './core.js';

/** 管理批量选择、预览与逐项提交，保存过程不切换正在学习的课程。 */
export function bindBatchImport({getLessons, isReady, saveLesson, onComplete, onViewLibrary}) {
  const panel = document.querySelector('#import-dialog');
  const form = document.querySelector('#import-form');
  const rowsElement = document.querySelector('#import-rows');
  const submit = document.querySelector('#import-submit');
  const result = document.querySelector('#import-result');
  const error = document.querySelector('#import-error');
  const inputs = ['#import-files', '#import-folder'].map(selector => document.querySelector(selector));
  let plan = null;
  let busy = false;
  let knownKeys = new Set();

  /** 统一锁定选择、清单和关闭按钮，阻止写入时重复提交。 */
  function setBusy(value) {
    busy = value;
    panel.setAttribute('aria-busy', String(value));
    panel.querySelectorAll('input, select, button').forEach(control => { control.disabled = value; });
    if (!value) render();
  }

  /** 计算当前匹配状态；只对已勾选且有效的项目保留本批重复键。 */
  function classifyRows() {
    const selectedKeys = new Set();
    for (const row of plan.rows) {
      const subtitle = plan.subtitles.find(item => item.index === row.subtitleIndex);
      row.cues = subtitle?.cues;
      row.key = row.cues ? importKey(row.media, row.cues) : null;
      row.status = row.saved ? 'saved' : !subtitle ? 'missing' : subtitle.error ? 'invalid' : knownKeys.has(row.key) || selectedKeys.has(row.key) ? 'duplicate' : 'ready';
      row.message = row.saved ? '已加入资料库' : !subtitle ? '未匹配字幕，请手动选择' : subtitle.error || (row.status === 'duplicate' ? '重复资料，已跳过并保留原记录' : `${row.cues.length} 句 · 可导入`);
      if (row.status !== 'ready') row.selected = false;
      else if (row.selected) selectedKeys.add(row.key);
    }
  }

  /** 将文件名和路径安全渲染到清单，并同步可提交数量。 */
  function render() {
    if (!plan) { submit.disabled = true; return; }
    classifyRows();
    rowsElement.innerHTML = plan.rows.map((row, index) => `<article class="import-row"><div class="import-row-head"><input type="checkbox" data-import-select="${index}" aria-label="导入第 ${index + 1} 条" ${row.selected ? 'checked' : ''} ${row.status !== 'ready' ? 'disabled' : ''}><input class="import-row-title" data-import-title="${index}" aria-label="第 ${index + 1} 条资料名称" value="${esc(row.title)}" maxlength="160" ${row.saved ? 'disabled' : ''}></div><p class="import-path">${esc(row.path)}</p><label class="import-subtitle">配套字幕<select data-import-subtitle="${index}" aria-label="第 ${index + 1} 条配套字幕" ${row.saved ? 'disabled' : ''}><option value="-1">暂不导入 / 请选择字幕</option>${plan.subtitles.map(sub => `<option value="${sub.index}" ${row.subtitleIndex === sub.index ? 'selected' : ''}>${esc(sub.path)}</option>`).join('')}</select></label><p class="import-row-status ${row.lastError ? 'failed' : row.status}">${esc(row.lastError || row.message)}</p></article>`).join('');
    const count = plan.rows.filter(row => row.selected && row.status === 'ready').length;
    const used = new Set(plan.rows.map(row => row.subtitleIndex));
    const unused = plan.subtitles.filter(sub => !used.has(sub.index));
    document.querySelector('#import-count').textContent = `${plan.rows.length} 个媒体 · 已选 ${count} 条`;
    document.querySelector('#import-unmatched').textContent = `${unused.length} 个字幕未使用 · 已忽略 ${plan.ignored} 个非媒体/字幕文件`;
    submit.disabled = busy || !count;
    submit.textContent = count ? `导入选中的 ${count} 条资料` : '没有可导入的已选资料';
  }

  /** 读取字幕并生成预览，取消系统文件选择时保留原待导入清单。 */
  async function selectFiles(files) {
    if (!files.length || busy) return;
    setBusy(true); error.textContent = ''; result.textContent = '';
    document.querySelector('#import-view-library').hidden = true;
    submit.textContent = '正在识别文件与字幕…';
    try {
      const next = matchImportFiles(files);
      for (const sub of next.subtitles) {
        try { Object.assign(sub, await readImportSubtitle(sub.file)); }
        catch (failure) { sub.error = failure.message || '无法读取字幕文件'; }
      }
      knownKeys = new Set(getLessons().map(lesson => importKey(lesson.blob, lesson.cues)).filter(Boolean));
      next.rows.forEach(row => { row.selected = true; });
      plan = next;
      document.querySelector('#import-preview').hidden = false;
      if (!plan.rows.length) error.textContent = '没有找到支持的媒体文件，请同时选择视频和字幕。';
    } catch (failure) { error.textContent = failure.message || '无法读取所选文件。'; }
    finally { setBusy(false); }
  }

  /** 逐项提交并保留部分成功结果；空间不足时停止后续写入。 */
  async function submitImport(event) {
    event.preventDefault();
    if (busy || !plan) return;
    if (!isReady()) { error.textContent = '本地资料库尚未就绪，请刷新后重试。'; return; }
    classifyRows();
    const queue = plan.rows.filter(row => row.selected && row.status === 'ready');
    if (!queue.length) return;
    setBusy(true); error.textContent = '';
    let added = 0;
    let failed = 0;
    try {
      const outcome = await saveImportRows(queue, saveLesson, knownKeys, (index, total) => { submit.textContent = `正在保存 ${index} / ${total}…`; });
      added = outcome.added; failed = outcome.failed;
      if (outcome.stopped) error.textContent = '浏览器空间不足，已停止后续导入。已成功的资料仍在资料库。';
      await onComplete();
    } catch { error.textContent = '资料库列表刷新失败，请重新打开资料库检查；已保存项目不会重复提交。'; }
    finally {
      result.textContent = `本次已导入 ${added} 条${failed ? `，${failed} 条保存失败` : ''}。${added ? '已加入资料库，当前学习保持不变。' : '请查看每条资料的提示。'}`;
      document.querySelector('#import-view-library').hidden = !plan.rows.some(row => row.saved);
      setBusy(false);
    }
    // 全部选中项保存成功后返回资料库；失败提示仍留在导入窗口。
    if (added > 0 && failed === 0 && !error.textContent) onViewLibrary();
  }

  inputs.forEach(input => input.addEventListener('change', () => { selectFiles(input.files); input.value = ''; }));
  rowsElement.addEventListener('input', event => {
    const index = event.target.dataset.importTitle;
    if (index !== undefined && !busy) plan.rows[+index].title = event.target.value;
  });
  rowsElement.addEventListener('change', event => {
    if (busy) return;
    const target = event.target;
    if (target.dataset.importSubtitle !== undefined) {
      const row = plan.rows[+target.dataset.importSubtitle];
      row.subtitleIndex = +target.value; row.selected = true; row.lastError = '';
    } else if (target.dataset.importSelect !== undefined) plan.rows[+target.dataset.importSelect].selected = target.checked;
    render();
  });
  form.addEventListener('submit', submitImport);
  panel.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  panel.addEventListener('click', event => { if (busy && event.target === panel) event.stopImmediatePropagation(); }, true);
  document.querySelector('#import-view-library').addEventListener('click', onViewLibrary);
  if (!('webkitdirectory' in inputs[1])) {
    document.querySelector('#import-folder-field').hidden = true;
    document.querySelector('#import-folder-help').textContent = '当前浏览器不支持文件夹选择，请用多文件选择同时选中视频与字幕。';
  }
}
