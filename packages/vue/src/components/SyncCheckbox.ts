import { defineComponent, h } from "vue";
import { useSyncField } from "../useSyncField";

export const SyncCheckbox = defineComponent({
  name: "SyncCheckbox",
  props: {
    collection: { type: String, required: true },
    docId: { type: String, required: true },
    field: { type: String, required: true },
  },
  setup(props, { attrs }) {
    const { value, setValue } = useSyncField<boolean>(props.collection, props.docId, props.field, false);

    const onChange = (event: Event) => {
      const target = event.target as HTMLInputElement;
      setValue(target.checked);
    };

    return () => {
      return h('input', {
        ...attrs,
        type: 'checkbox',
        checked: value.value,
        onChange
      });
    };
  }
});
