"use client";

import { useState } from "react";

type DropdownVariant = "default" | "glass" | "rounded" | "bold";

type DropdownProps = {
  label?: string;
  options: string[];
  onSelect: (value: string) => void;
  variant?: DropdownVariant;
};

const baseStyles: Record<DropdownVariant, string> = {
  default: "border bg-white rounded shadow hover:bg-gray-100",
  glass: "border border-emerald-400 bg-white/80 rounded-xl shadow-md backdrop-blur-md text-emerald-700 font-semibold hover:bg-emerald-50",
  rounded: "border border-purple-400 bg-purple-50 rounded-full shadow hover:bg-purple-100 text-purple-700 font-bold",
  bold: "bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700",
};

export default function Dropdown({
  label = "Select ▾",
  options,
  onSelect,
  variant = "default",
}: DropdownProps) {
  return (
    <div className="inline-block relative group cursor-pointer w-fit">
      <div className={`inline-block px-4 py-2 whitespace-nowrap ${baseStyles[variant]}`}>
        {label}
      </div>
      <div className="absolute top-full right-0 hidden group-hover:block bg-white text-black border border-gray-300 p-2 w-40 z-50">
        {options.map((option) => (
          <div
            key={option}
            onClick={() => onSelect(option)}
            className="py-2 px-4 hover:bg-gray-100 rounded cursor-pointer"
          >
            {option.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}

// DEMO BLOCK (for testing elsewhere — NOT inside this component)
// Suggested to move this to your design guide, not inside Dropdown itself
// import Dropdown from '@/components/ui/Dropdown';
// const levels = ["l1", "l2", "l3", "l4", "l5"];
// <Dropdown label="Shared Dropdown ▾" options={levels} onSelect={...} />
// <Dropdown label="Choose Level ▾" variant="glass" options={levels} onSelect={...} />
// <Dropdown label="Select Level ▾" variant="rounded" options={levels} onSelect={...} />
