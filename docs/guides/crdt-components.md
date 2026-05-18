# React and Vue CRDT Component Library

Wiring UI state to database state manually creates boilerplate. ZerithDB provides an official suite of unstyled UI components (Inputs, Checkboxes, Toggles) that bind directly and reactively to underlying CRDT fields.

## React Example

```tsx
import { SyncInput, SyncCheckbox, SyncToggle } from "zerithdb-react";

export function CollaborativeForm() {
  return (
    <form>
      <label>
        Title:
        <SyncInput collection="posts" docId="post-1" field="title" />
      </label>
      <label>
        Published:
        <SyncCheckbox collection="posts" docId="post-1" field="isPublished" />
      </label>
      <label>
        Notifications:
        <SyncToggle collection="posts" docId="post-1" field="notifyUsers" />
      </label>
    </form>
  );
}
```

## Vue Example

```vue
<script setup>
import { SyncInput, SyncCheckbox, SyncToggle } from "zerithdb-vue";
</script>

<template>
  <form>
    <label>
      Title:
      <SyncInput collection="posts" docId="post-1" field="title" />
    </label>
    <label>
      Published:
      <SyncCheckbox collection="posts" docId="post-1" field="isPublished" />
    </label>
    <label>
      Notifications:
      <SyncToggle collection="posts" docId="post-1" field="notifyUsers" />
    </label>
  </form>
</template>
```

## Performance & Architecture
- **Framework Agnostic Core:** The core logic is housed in `@zerithdb/ui-core`, providing the `FieldBinder` class which efficiently connects a CRDT to a DOM element.
- **Optimistic Updates:** Component values reflect immediately on user input. If validation fails on the network or database level, the core triggers a rollback to the last valid state automatically.
- **Presence Indicators:** Hooks like `usePresence` enable out-of-the-box presence indicators on inputs showing other users viewing the same field.
