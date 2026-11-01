import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { defineComponent } from "vue";
import SoftSelect from "../../src/components/ui/SoftSelect.vue";

let wrappers;
const options = [{ value: "", label: "Semua kelas" }, { value: "A", label: "Kelas A" }, { value: "B", label: "Kelas B" }];
beforeEach(() => { wrappers = []; });
afterEach(() => { wrappers.forEach(wrapper => wrapper.unmount()); document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(props = {}) {
  const wrapper = mount(SoftSelect, { attachTo: document.body, props: { label: "Kelas", modelValue: "", options, ...props } });
  wrappers.push(wrapper);
  return { wrapper, trigger: wrapper.get('[role="combobox"]') };
}
const popup = () => document.querySelector('[role="listbox"]');
const active = trigger => document.getElementById(trigger.attributes('aria-activedescendant'));

it("opens a themed list with accessible selection state and commits pointer choices", async () => {
  const { wrapper, trigger } = setup();
  trigger.element.focus();
  await trigger.trigger('click');
  expect(trigger.attributes('aria-expanded')).toBe('true');
  expect(popup().id).toBe(trigger.attributes('aria-controls'));
  expect(popup().querySelector('[aria-selected="true"]').textContent).toBe('Semua kelas');
  popup().querySelector('[data-value="B"]').click();
  await flushPromises();
  expect(wrapper.emitted('update:modelValue')).toEqual([['B']]);
  expect(popup()).toBeNull();
  expect(document.activeElement).toBe(trigger.element);
  await wrapper.setProps({ modelValue: 'B' });
  expect(trigger.text()).toContain('Kelas B');
});
it("navigates without changing the value until Enter and skips disabled choices", async () => {
  const { wrapper, trigger } = setup({ options: [options[0], { ...options[1], disabled: true }, options[2]] });
  await trigger.trigger('keydown', { key: 'ArrowDown' });
  expect(active(trigger).dataset.value).toBe('');
  await trigger.trigger('keydown', { key: 'ArrowDown' });
  expect(active(trigger).dataset.value).toBe('B');
  expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  await trigger.trigger('keydown', { key: 'Home' });
  expect(active(trigger).dataset.value).toBe('');
  await trigger.trigger('keydown', { key: 'End' });
  await trigger.trigger('keydown', { key: 'Enter' });
  expect(wrapper.emitted('update:modelValue')).toEqual([['B']]);
});
it("dismisses with Escape or Tab without changing the committed selection", async () => {
  const { wrapper, trigger } = setup();
  await trigger.trigger('click');
  await trigger.trigger('keydown', { key: 'End' });
  await trigger.trigger('keydown', { key: 'Escape' });
  expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  expect(popup()).toBeNull();
  expect(document.activeElement).toBe(trigger.element);
  await trigger.trigger('click');
  await trigger.trigger('keydown', { key: 'Tab' });
  expect(popup()).toBeNull();
});
it("supports type-ahead and Space confirmation", async () => {
  const { wrapper, trigger } = setup({ label: 'Mata kuliah', modelValue: 'db', options: [{ value: 'db', label: 'Basis Data' }, { value: 'net', label: 'Jaringan Komputer' }, { value: 'os', label: 'Sistem Operasi' }] });
  await trigger.trigger('keydown', { key: 's' });
  expect(active(trigger).dataset.value).toBe('os');
  expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  await trigger.trigger('keydown', { key: ' ' });
  expect(wrapper.emitted('update:modelValue')).toEqual([['os']]);
});
it("allows only one popup at a time and gives each instance unique ARIA IDs", async () => {
  const Host = defineComponent({ components: { SoftSelect }, setup: () => ({ options }), template: '<div><SoftSelect label="Kelas" :options="options" /><SoftSelect label="Mata kuliah" :options="options" /></div>' });
  const wrapper = mount(Host, { attachTo: document.body }); wrappers.push(wrapper);
  const buttons = wrapper.findAll('[role="combobox"]');
  expect(buttons[0].attributes('id')).not.toBe(buttons[1].attributes('id'));
  await buttons[0].trigger('click');
  await buttons[1].trigger('click');
  expect(document.querySelectorAll('[role="listbox"]')).toHaveLength(1);
  expect(buttons[0].attributes('aria-expanded')).toBe('false');
  expect(popup().id).toBe(buttons[1].attributes('aria-controls'));
});
it("closes on outside pointer/focus without taking focus away from the next control", async () => {
  const { trigger } = setup();
  const outside = document.createElement('button'); document.body.append(outside);
  await trigger.trigger('click');
  outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  outside.focus();
  await flushPromises();
  expect(popup()).toBeNull();
  expect(document.activeElement).toBe(outside);
  await trigger.trigger('click');
  trigger.element.focus();
  outside.focus();
  await flushPromises();
  expect(popup()).toBeNull();
});
it("flips above and stays inside the viewport near the bottom/right edges", async () => {
  vi.stubGlobal('innerWidth', 1024); vi.stubGlobal('innerHeight', 768);
  const { trigger } = setup();
  trigger.element.getBoundingClientRect = () => ({ left: 900, right: 1120, top: 700, bottom: 748, width: 220, height: 48 });
  await trigger.trigger('click');
  expect(popup().style.left).toBe('792px');
  expect(popup().style.bottom).toBe('76px');
  expect(popup().style.width).toBe('220px');
  popup().dispatchEvent(new Event('scroll'));
  await flushPromises(); expect(popup()).not.toBeNull();
  window.dispatchEvent(new Event('resize'));
  await flushPromises(); expect(popup()).toBeNull();
});
it("updates changing options safely, closes on external selection, and handles empty/disabled controls", async () => {
  const { wrapper, trigger } = setup();
  await trigger.trigger('click');
  await wrapper.setProps({ options: [{ value: 'new', label: 'Kelas baru' }] });
  await flushPromises();
  expect(active(trigger).dataset.value).toBe('new');
  await wrapper.setProps({ modelValue: 'new' });
  expect(popup()).toBeNull();
  await trigger.trigger('click');
  await wrapper.setProps({ disabled: true });
  expect(trigger.element.disabled).toBe(true);
  expect(popup()).toBeNull();
  await wrapper.setProps({ disabled: false, options: [] });
  expect(trigger.element.disabled).toBe(true);
});
it("removes teleported popups and global listeners when unmounted", async () => {
  const removeDocument = vi.spyOn(document, 'removeEventListener');
  const removeWindow = vi.spyOn(window, 'removeEventListener');
  const { wrapper, trigger } = setup();
  await trigger.trigger('click');
  wrapper.unmount();
  wrappers = [];
  await flushPromises();
  expect(popup()).toBeNull();
  expect(removeDocument.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining(['pointerdown', 'focusin', 'examnia:soft-field-open']));
  expect(removeWindow.mock.calls.map(([name]) => name)).toEqual(expect.arrayContaining(['scroll', 'resize', 'blur']));
});
