import { defineComponent, h, PropType } from "vue";
import { useSyncField, usePresence } from "../useSyncField";

export const SyncInput = defineComponent({
  name: "SyncInput",
  props: {
    collection: { type: String, required: true },
    docId: { type: String, required: true },
    field: { type: String, required: true },
  },
  setup(props, { attrs }) {
    const { value, setValue, error } = useSyncField<string>(props.collection, props.docId, props.field, "");
    const presence = usePresence(props.collection, props.docId, props.field);

    const onInput = (event: Event) => {
      const target = event.target as HTMLInputElement;
      setValue(target.value);
    };

    return () => {
      const presenceIndicators = presence.value.length > 0
        ? h('div', { class: 'zerith-presence-indicators', style: { position: 'absolute', top: '-20px', right: 0, fontSize: '10px' } }, `${presence.value.length} others here`)
        : null;

      const input = h('input', {
        ...attrs,
        value: value.value,
        'data-error': !!error.value,
        onInput
      });

      return h('div', { class: 'zerith-sync-input-container', style: { position: 'relative' } }, [
        input,
        presenceIndicators
      ]);
    };
  }
});
