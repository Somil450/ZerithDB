import React from "react";
import { useSyncField } from "../useSyncField";

export interface SyncCheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  collection: string;
  docId: string;
  field: string;
}

export const SyncCheckbox = React.forwardRef<HTMLInputElement, SyncCheckboxProps>(
  ({ collection, docId, field, ...props }, ref) => {
    const { value, setValue } = useSyncField<boolean>(collection, docId, field, false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.checked);
    };

    return (
      <input
        type="checkbox"
        ref={ref}
        checked={value}
        onChange={handleChange}
        {...props}
      />
    );
  }
);
SyncCheckbox.displayName = "SyncCheckbox";
