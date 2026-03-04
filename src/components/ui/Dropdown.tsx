// src/components/ui/DropDown.tsx
"use client";

import { useState, useEffect, useRef } from "react";

type DropdownVariant = "default" | "glass" | "blue" | "rounded" | "bold" | "auth";

type DropdownOption = { label: string; value: string; disabled?: boolean };

type DropdownProps = {
  label?: string;
  options: DropdownOption[];
  onSelect: (value: string) => void;
  variant?: DropdownVariant;
  onOpenChange?: (isOpen: boolean) => void;
};

const baseStyles: Record<DropdownVariant, string> = {
  default: "border bg-white rounded shadow hover:bg-gray-100 px-4 py-2",
  glass:
    "border border-indigo-200 bg-[#f5f0e6] rounded-xl shadow-md backdrop-blur-md text-indigo-600 font-medium hover:bg-[#ede4d3] px-4 py-2 transition-colors",
  blue:
  "border border-sky-400 bg-white/80 rounded-xl shadow-md backdrop-blur-md text-sky-700 font-semibold hover:bg-sky-50 px-4 py-2",
  rounded:
    "border border-purple-400 bg-purple-50 rounded-full shadow hover:bg-purple-100 text-purple-700 font-bold px-4 py-2",
  bold: "bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 px-4 py-2",
  auth: "px-4 py-2 border rounded-lg bg-white text-left",
};

export default function Dropdown({
  label = "Select ▾",
  options,
  onSelect,
  variant = "default",
  onOpenChange,
}: DropdownProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    onOpenChange?.(newOpen);
  };
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        handleOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
  <div
    ref={dropdownRef}
    className="inline-block relative w-[300px]" // 👈 FIXED WIDTH HERE
    onClick={(e) => e.stopPropagation()}
    data-dropdown
  >
    <button
      type="button"
      onClick={() => handleOpenChange(!open)}
      className={`${baseStyles[variant]} cursor-pointer w-full text-left`}
    >
      {label}
    </button>

    {open && (
      <div className="absolute top-full left-0 mt-1 w-full bg-white/95 backdrop-blur-md text-black border border-white/10 rounded-xl shadow-md z-50 max-h-60 overflow-y-auto">
        {options.map(({ label, value, disabled }) => (
          <div
            key={value}
            onClick={() => {
              if (!disabled) {
                onSelect(value);
                handleOpenChange(false);
              }
            }}
            className={`px-4 py-2 ${
              disabled
                ? "text-gray-400 cursor-default"
                : "hover:bg-gray-100 cursor-pointer"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    )}
  </div>
);
}


// DEMO BLOCK (for testing elsewhere — NOT inside this component)
// import Dropdown from '@/components/ui/Dropdown';
// const levels = ["l1", "l2", "l3", "l4", "l5"];
// <Dropdown label="Shared Dropdown ▾" options={levels} onSelect={...} />
// <Dropdown label="Choose Level ▾" variant="glass" options={levels} onSelect={...} />
// <Dropdown label="Select Level ▾" variant="rounded" options={levels} onSelect={...} />
// <Dropdown label="Choose Language" variant="auth" options={["en", "es"]} onSelect={...} />
