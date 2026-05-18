<script lang="ts">
  import { syncField, syncPresence } from "../useSyncField";

  export let collection: string;
  export let docId: string;
  export let field: string;
  export let placeholder: string = "";
  
  const value = syncField<string>(collection, docId, field, "");
  const presence = syncPresence(collection, docId, field);

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement;
    value.set(target.value);
  }
</script>

<div class="zerith-sync-input-container" style="position: relative;">
  <input 
    type="text" 
    value={$value} 
    on:input={handleInput} 
    {placeholder}
    {...$$restProps}
  />
  {#if $presence.length > 0}
    <div class="zerith-presence-indicators" style="position: absolute; top: -20px; right: 0; font-size: 10px;">
      {$presence.length} others here
    </div>
  {/if}
</div>
