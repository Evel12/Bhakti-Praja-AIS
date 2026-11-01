import { flushPromises } from "@vue/test-utils";
import SoftSelect from "../../src/components/ui/SoftSelect.vue";

export async function chooseSoftSelect(wrapper, label, value) {
  const field = wrapper.findAllComponents(SoftSelect).find(component => component.props("label") === label);
  if (!field) throw new Error(`Missing Soft Fields control: ${label}`);
  const trigger = field.get('[role="combobox"]');
  if (trigger.attributes("aria-expanded") !== "true") await trigger.trigger("click");
  await flushPromises();
  const option = [...document.querySelectorAll('.soft-field-option')].find(node => node.dataset.value === value);
  if (!option) throw new Error(`Missing option ${value} in ${label}`);
  option.click();
  await flushPromises();
  return trigger;
}
