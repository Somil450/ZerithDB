<script lang="ts">
  import { syncField } from "../useSyncField";

  export let collection: string;
  export let docId: string;
  export let field: string;
  
  const checked = syncField<boolean>(collection, docId, field, false);

  function handleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    checked.set(target.checked);
  }
</script>

<input 
  type="checkbox" 
  checked={$checked} 
  on:change={handleChange} 
  {...$$restProps}
/>
