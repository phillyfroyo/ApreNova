'use client'

import { useState } from 'react'

type EditableFieldProps = {
  label: string
  value: string
  onSave: (newValue: string) => void
  inputType?: 'text' | 'select'
  options?: string[] // for dropdowns like language or level
  variant?: 'default' | 'blue';
}

const variantStyles = {
  default: "ml-2 text-sm border px-1 rounded",
  blue: "ml-2 text-sm border border-sky-400 bg-white/80 rounded-xl shadow-md backdrop-blur-md text-sky-700 font-semibold hover:bg-sky-50 px-4 py-2",
};

export default function EditableField({
  label,
  value,
  onSave,
  inputType = 'text',
  options = [],
  variant = 'default',
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const handleSave = () => {
    onSave(draft)
    setIsEditing(false)
  }

  return (
    <div className="flex items-center gap-2 text-sm mb-3">
      <div className="w-full">
        <span className="font-semibold">{label}</span>{' '}
        {isEditing ? (
          inputType === 'select' ? (
            <select
  value={draft}
  onChange={(e) => setDraft(e.target.value)}
  className={variantStyles[variant || 'default']}
>
  {options.map((opt) => (
    <option key={opt} value={opt}>
      {opt}
    </option>
  ))}
</select>
          ) : (
            <input
  className={variantStyles[variant || 'default']}
  value={draft}
  onChange={(e) => setDraft(e.target.value)}
/>
          )
        ) : (
          <span className="ml-1">{value}</span>
        )}
      </div>

      {isEditing ? (
        <button onClick={handleSave} className="text-green-600 text-xs">
          ✅
        </button>
      ) : (
        <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-black">
          ✏️
        </button>
      )}
    </div>
  )
}
