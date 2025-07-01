"use client";
import { useState } from "react";

type DropdownProps = {
  label: string;
  options: string[];
  onSelect: (value: string) => void;
};

export default function Dropdown({ label, options, onSelect }: DropdownProps) {
  return (
    <div className="relative group cursor-pointer">
      <div className="px-3 py-1 border bg-white rounded shadow hover:bg-gray-100">
        {label}
      </div>
      <div className="absolute top-full right-0 hidden group-hover:block bg-white text-black border border-gray-300 p-2 w-36 z-50">
        {options.map((opt) => (
          <div
            key={opt}
            onClick={() => onSelect(opt)}
            className="hover:underline cursor-pointer py-1"
          >
            {opt.toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
