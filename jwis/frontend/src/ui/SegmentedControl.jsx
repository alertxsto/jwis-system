import React from "react";

export function SegmentedControl({ label, value, options, onChange }) {
  return (
    <div className="segmented-control" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          disabled={option.disabled}
          title={option.title}
          onClick={() => {
            if (!option.disabled) onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
