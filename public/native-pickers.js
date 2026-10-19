// Turns every <input type="datetime-local"> and <input type="time"> on the page
// into our wheel picker, without changing the forms that use them.
//
// How: the input becomes type="hidden" (same name, same value format, so the
// form code keeps reading input.value exactly as before) and a button showing
// the chosen value is placed next to it. Tapping the button opens the wheel.
// A MutationObserver also upgrades inputs that app.js renders later (groups,
// meeting polls, settings …).

import { fromHkInputValue, toHkInputValue } from './reminder-logic.js';
import { formatHk, openDateTimePicker, openTimePicker } from './wheel-picker.js';

const lang = () => document.documentElement.lang || 'zh-CN';
const L = (cn, tw, en) => (lang() === 'zh-TW' ? tw : lang() === 'en' ? en : cn);
const valueProperty = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

/** Text of the <label> around the input, without the button's own text. */
function labelText(input) {
  const label = input.closest('label');
  if (!label) return input.getAttribute('aria-label') || '';
  return [...label.childNodes].filter(n => n.nodeType === Node.TEXT_NODE || (n.nodeType === 1 && !n.matches('button,input,small'))).map(n => n.textContent).join(' ').trim();
}

function upgrade(input) {
  const kind = input.type; // 'datetime-local' or 'time'
  input.dataset.wheel = kind;
  input.type = 'hidden'; // keeps name, value and required; the browser stops drawing its own picker

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'picker-button';
  if (input.name) button.dataset.pickerFor = input.name;
  input.after(button);

  const show = () => {
    const value = valueProperty.get.call(input);
    const text = !value ? L('选择时间', '選擇時間', 'Choose a time') : kind === 'time' ? value : formatHk(fromHkInputValue(value));
    button.textContent = text;
    button.classList.toggle('is-empty', !value);
    button.setAttribute('aria-label', `${labelText(input)} ${text}`.trim());
  };
  // When app.js sets input.value = '…' in code, refresh the button text too.
  Object.defineProperty(input, 'value', {
    configurable: true,
    get() { return valueProperty.get.call(this); },
    set(next) { valueProperty.set.call(this, next); show(); },
  });
  show();

  button.addEventListener('click', async () => {
    const title = labelText(input) || L('选择时间', '選擇時間', 'Choose a time');
    const allowClear = !input.required;
    let next;
    if (kind === 'time') {
      next = await openTimePicker({ title, value: input.value, allowClear });
    } else {
      const ms = await openDateTimePicker({ title, value: input.value ? fromHkInputValue(input.value) : null, allowClear });
      next = ms === undefined ? undefined : toHkInputValue(ms);
    }
    if (next === undefined) return; // cancelled
    input.value = next;
    button.closest('label,.field')?.querySelector('.picker-error')?.remove();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/** Upgrade the native time inputs inside `root` (default: the whole page). */
export function upgradeTimeInputs(root = document) {
  if (root.matches?.('input[type=datetime-local],input[type=time]')) upgrade(root);
  root.querySelectorAll?.('input[type=datetime-local],input[type=time]').forEach(upgrade);
}

/**
 * Upgrade now and whenever new HTML is added.
 * Hidden inputs are skipped by the browser's "required" check, so we check
 * them ourselves before any form is submitted.
 */
export function watchTimeInputs() {
  upgradeTimeInputs();
  new MutationObserver(records => {
    for (const record of records) record.addedNodes.forEach(node => { if (node.nodeType === 1) upgradeTimeInputs(node); });
  }).observe(document.body, { childList: true, subtree: true });

  // Capture phase: runs before the form's own onsubmit handler.
  document.addEventListener('submit', event => {
    const missing = [...event.target.querySelectorAll('input[data-wheel][required]')].filter(input => !input.value);
    if (!missing.length) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    for (const input of missing) {
      const holder = input.closest('label,.field') || input.parentElement;
      if (!holder.querySelector('.picker-error')) {
        const note = document.createElement('small');
        note.className = 'picker-error error';
        note.setAttribute('role', 'alert');
        note.textContent = L('请选择时间', '請選擇時間', 'Please choose a time');
        holder.append(note);
      }
    }
    missing[0].nextElementSibling?.focus();
  }, true);
}
