import React from "react";
import { useSyncField, usePresence } from "../useSyncField";

export interface SyncInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  collection: string;
  docId: string;
  field: string;
}

export const SyncInput = React.forwardRef<HTMLInputElement, SyncInputProps>(
  ({ collection, docId, field, ...props }, ref) => {
    const { value, setValue, error } = useSyncField<string>(collection, docId, field, "");
    const presence = usePresence(collection, docId, field);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
    };

    return (
      <div className="zerith-sync-input-container" style={{ position: "relative" }}>
        <input
          ref={ref}
          value={value}
          onChange={handleChange}
          data-error={!!error}
          {...props}
        />
        {presence.length > 0 && (
          <div className="zerith-presence-indicators" style={{ position: "absolute", top: -20, right: 0, fontSize: 10 }}>
            {presence.length} others here
          </div>
        )}
      </div>
    );
  }
);
SyncInput.displayName = "SyncInput";
