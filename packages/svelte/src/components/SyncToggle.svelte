<script lang="ts">
  import { syncField } from "../useSyncField";

  export let collection: string;
  export let docId: string;
  export let field: string;
  
  const value = syncField<boolean>(collection, docId, field, false);

  function toggle() {
    value.update(v => !v);
  }
</script>

<button 
  type="button" 
  aria-pressed={$value} 
  on:click={toggle}
  {...$$restProps}
>
  <slot value={$value}>
    {$value ? "On" : "Off"}
  </slot>
</button>
