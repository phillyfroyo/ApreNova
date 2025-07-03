"use client";

import { useState, useEffect, useRef } from "react";

type DropdownVariant = "default" | "glass" | "rounded" | "bold" | "auth";

type DropdownProps = {
  label?: string;
  options: string[];
  onSelect: (value: string) => void;
  variant?: DropdownVariant;
};

const baseStyles: Record<DropdownVariant, string> = {
  default: "border bg-white rounded shadow hover:bg-gray-100 px-4 py-2",
  glass:
    "border border-emerald-400 bg-white/80 rounded-xl shadow-md backdrop-blur-md text-emerald-700 font-semibold hover:bg-emerald-50 px-4 py-2",
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
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
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
      className="inline-block relative w-fit"
    >
      <button
  onClick={() => setOpen((prev) => !prev)}
  className={`${baseStyles[variant]} cursor-pointer w-full text-left`}
>
  {label}
</button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-full bg-white/30 backdrop-blur-md text-black border border-white/10 rounded-xl shadow-md z-50"
        >
          {options.map((option) => (
            <div
              key={option}
              onClick={() => {
                onSelect(option);
                setOpen(false);
              }}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
            >
              {option === 'en' ? 'English' : option === 'es' ? 'Español' : option.toUpperCase()}
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
