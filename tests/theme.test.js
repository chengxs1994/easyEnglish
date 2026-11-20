import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../theme.js', import.meta.url), 'utf8');

/** 模拟浏览器的主题控件与偏好存储，验证独立主题脚本的外部行为。 */
function browser({dark = false, saved = null, storageFails = false} = {}) {
  const events = {};
  const system = {matches: dark, addEventListener: (_, listener) => { events.system = listener; }};
  const status = {textContent: '', classList: {toggle() {}}};
  const meta = {setAttribute: (_, value) => { meta.content = value; }};
  const buttons = ['light', 'dark'].map(theme => ({dataset: {themeChoice: theme}, setAttribute(name, value) { this[name] = value; }, addEventListener(_, listener) { this.click = listener; }}));
  const root = {dataset: {}};
  const localStorage = {getItem() { if (storageFails) throw Error('blocked'); return saved; }, setItem(_, value) { if (storageFails) throw Error('blocked'); saved = value; }};
  const document = {documentElement: root, querySelector: selector => selector.startsWith('meta') ? meta : status, querySelectorAll: () => buttons, addEventListener: (_, listener) => { events.ready = listener; }};
  vm.runInNewContext(source, {window: {matchMedia: () => system}, document, localStorage});
  events.ready();
  return {root, meta, buttons, status, saved: () => saved, changeSystem(value) { system.matches = value; events.system(); }};
}

test('首次主题跟随系统，并在未手动选择时响应系统变化', () => {
  const view = browser({dark: false});
  assert.equal(view.root.dataset.theme, 'light');
  assert.equal(view.buttons[0]['aria-pressed'], 'true');
  view.changeSystem(true);
  assert.equal(view.root.dataset.theme, 'dark');
  assert.equal(view.meta.content, '#131209');
  assert.equal(view.saved(), null);
});

test('手动选择覆盖系统并可在刷新后恢复，选中状态保持互斥', () => {
  const view = browser({dark: true});
  view.buttons[0].click();
  view.changeSystem(true);
  assert.equal(view.root.dataset.theme, 'light');
  assert.equal(view.saved(), 'light');
  assert.equal(view.buttons[0]['aria-pressed'], 'true');
  assert.equal(view.buttons[1]['aria-pressed'], 'false');
  const reopened = browser({dark: true, saved: view.saved()});
  assert.equal(reopened.root.dataset.theme, 'light');
  assert.equal(reopened.meta.content, '#f7f7f2');
});

test('无效偏好回退系统；存储不可用时仍可切换并提示不能保存', () => {
  assert.equal(browser({dark: true, saved: 'invalid'}).root.dataset.theme, 'dark');
  const view = browser({storageFails: true});
  view.buttons[1].click();
  assert.equal(view.root.dataset.theme, 'dark');
  view.changeSystem(false);
  assert.equal(view.root.dataset.theme, 'dark');
  assert.match(view.status.textContent, /无法保存主题/);
});
