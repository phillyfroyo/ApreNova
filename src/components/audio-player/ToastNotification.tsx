// src/components/audio-player/ToastNotification.tsx
"use client";

interface ToastNotificationProps {
  visible: boolean;
  fading: boolean;
  badge: string;
  badgeColor: string;
  label: string;
}

export default function ToastNotification({ visible, fading, badge, badgeColor, label }: ToastNotificationProps) {
  if (!visible) return null;

  return (
    <div className={`absolute bottom-full mb-2 left-0 right-0 flex justify-center pointer-events-none z-10 transition-opacity duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/85 text-white text-xs font-medium shadow-lg">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${badgeColor}`}>
          {badge}
        </span>
        {label}
      </div>
    </div>
  );
}
