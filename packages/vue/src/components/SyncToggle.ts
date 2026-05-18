import { defineComponent, h } from "vue";
import { useSyncField } from "../useSyncField";

export const SyncToggle = defineComponent({
  name: "SyncToggle",
  props: {
    collection: { type: String, required: true },
    docId: { type: String, required: true },
    field: { type: String, required: true },
  },
  setup(props, { attrs, slots }) {
    const { value, setValue } = useSyncField<boolean>(props.collection, props.docId, props.field, false);

    const onClick = () => {
      setValue(!value.value);
    };

    return () => {
      const defaultText = value.value ? "On" : "Off";
      return h('button', {
        ...attrs,
        type: 'button',
        'aria-pressed': value.value,
        onClick
      }, slots.default ? slots.default({ value: value.value }) : defaultText);
    };
  }
});
