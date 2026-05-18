import { useEffect, useState, useCallback, useRef } from "react";
import { useZerith } from "./useZerith";
import { FieldBinder, PresenceManager } from "zerithdb-ui-core";

export function useSyncField<T = string>(collection: string, id: string, field: string, defaultValue: T) {
  const app = useZerith();
  const [value, setValue] = useState<T>(defaultValue);
  const [error, setError] = useState<Error | null>(null);
  
  const binderRef = useRef<FieldBinder<T> | null>(null);

  useEffect(() => {
    const binder = new FieldBinder<T>(app, collection, id, field);
    binderRef.current = binder;
    
    binder.on("change", (val: T) => {
      setValue(val ?? defaultValue);
      setError(null);
    });

    binder.on("error", (err: Error) => {
      setError(err);
    });

    binder.bind();

    return () => {
      binder.unbind();
    };
  }, [app, collection, id, field, defaultValue]);

  const updateValue = useCallback((newValue: T) => {
    if (binderRef.current) {
      binderRef.current.update(newValue);
    } else {
      setValue(newValue);
    }
  }, []);

  return {
    value,
    setValue: updateValue,
    error,
  };
}

export function usePresence(collection: string, id: string, field: string) {
  const app = useZerith();
  const [presence, setPresence] = useState<any[]>([]);

  useEffect(() => {
    const manager = new PresenceManager(app, collection, id, field);
    
    manager.on("presence:change", (state: any[]) => {
      setPresence(state);
    });

    manager.bind();

    return () => {
      manager.unbind();
    };
  }, [app, collection, id, field]);

  return presence;
}
