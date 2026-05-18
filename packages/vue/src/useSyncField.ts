import { ref, onMounted, onUnmounted, inject, Ref } from "vue";
import type { ZerithDBApp } from "zerithdb-sdk";
import { FieldBinder, PresenceManager } from "zerithdb-ui-core";

export const ZERITH_APP_KEY = Symbol("ZERITH_APP_KEY");

export function useZerith(): ZerithDBApp {
  const app = inject<ZerithDBApp>(ZERITH_APP_KEY);
  if (!app) {
    throw new Error("useZerith must be used within a component providing ZERITH_APP_KEY");
  }
  return app;
}

export function useSyncField<T = string>(collection: string, id: string, field: string, defaultValue: T) {
  const app = useZerith();
  const value = ref<T>(defaultValue) as Ref<T>;
  const error = ref<Error | null>(null);
  
  let binder: FieldBinder<T> | null = null;

  onMounted(() => {
    binder = new FieldBinder<T>(app, collection, id, field);
    
    binder.on("change", (val: T) => {
      value.value = (val ?? defaultValue) as any;
      error.value = null;
    });

    binder.on("error", (err: Error) => {
      error.value = err;
    });

    binder.bind();
  });

  onUnmounted(() => {
    if (binder) {
      binder.unbind();
    }
  });

  const setValue = (newValue: T) => {
    if (binder) {
      binder.update(newValue);
    } else {
      value.value = newValue as any;
    }
  };

  return {
    value,
    setValue,
    error,
  };
}

export function usePresence(collection: string, id: string, field: string) {
  const app = useZerith();
  const presence = ref<any[]>([]);
  let manager: PresenceManager | null = null;

  onMounted(() => {
    manager = new PresenceManager(app, collection, id, field);
    
    manager.on("presence:change", (state: any[]) => {
      presence.value = state;
    });

    manager.bind();
  });

  onUnmounted(() => {
    if (manager) {
      manager.unbind();
    }
  });

  return presence;
}
