import { writable, type Writable, readable, type Readable } from "svelte/store";
import { getZerith } from "./index";
import { FieldBinder, PresenceManager } from "zerithdb-ui-core";

export function syncField<T = string>(collection: string, id: string, field: string, defaultValue: T): Writable<T> {
  const app = getZerith();
  
  const { subscribe, set } = writable<T>(defaultValue, (set) => {
    const binder = new FieldBinder<T>(app, collection, id, field);
    
    binder.on("change", (val: T) => {
      set(val ?? defaultValue);
    });

    binder.bind();

    return () => {
      binder.unbind();
    };
  });

  return {
    subscribe,
    set: (newValue: T) => {
      const binder = new FieldBinder<T>(app, collection, id, field);
      binder.update(newValue);
    },
    update: (updater: (value: T) => T) => {
      // For a proper update, we need the current value.
      // Svelte's updater pattern can be complex with external state, but we'll approximate.
      let current: T = defaultValue;
      const unsubscribe = subscribe(value => { current = value; });
      unsubscribe();
      
      const binder = new FieldBinder<T>(app, collection, id, field);
      binder.update(updater(current));
    }
  };
}

export function syncPresence(collection: string, id: string, field: string): Readable<any[]> {
  const app = getZerith();
  
  return readable<any[]>([], (set) => {
    const manager = new PresenceManager(app, collection, id, field);
    
    manager.on("presence:change", (state: any[]) => {
      set(state);
    });

    manager.bind();

    return () => {
      manager.unbind();
    };
  });
}
