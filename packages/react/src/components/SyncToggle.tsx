import React from "react";
import { useSyncField } from "../useSyncField";

export interface SyncToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  collection: string;
  docId: string;
  field: string;
}

export const SyncToggle = React.forwardRef<HTMLButtonElement, SyncToggleProps>(
  ({ collection, docId, field, ...props }, ref) => {
    const { value, setValue } = useSyncField<boolean>(collection, docId, field, false);

    const toggle = () => {
      setValue(!value);
    };

    return (
      <button
        type="button"
        ref={ref}
        onClick={toggle}
        aria-pressed={value}
        {...props}
      >
        {value ? "On" : "Off"}
      </button>
    );
  }
);
SyncToggle.displayName = "SyncToggle";
