// src/styles/cardPresets.ts
export const cardPresets = {
  glass: {
    title: "🍬 Glassmorphism",
    description: "Frosted glass style with soft blur.",
    className:
      "bg-white/30 backdrop-blur-md border border-white/10 text-black shadow-md hover:shadow-lg rounded-3xl p-6",
  },
  glow: {
    title: "✨ Soft Glow",
    description: "Bright card with subtle glowing ring.",
    className:
      "bg-white shadow-2xl ring-1 ring-inset ring-neutral-200 p-6 rounded-3xl",
  },
  dark: {
    title: "🌑 Dark Theme",
    description: "Dark card with contrast and shadow.",
    className:
      "bg-neutral-900 text-white p-6 rounded-3xl shadow-lg border border-neutral-700",
  },
  soft: {
    title: "🧁 Soft Theme",
    description: "Light theme with minimal contrast.",
    className:
      "bg-neutral-50 border border-neutral-200 shadow-sm p-6 rounded-3xl",
  },
};
