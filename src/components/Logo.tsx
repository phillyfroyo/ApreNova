// src/components/Logo.tsx

interface LogoProps {
  variant?: string;
  size?: string;
  className?: string;
}

export default function Logo({ variant = 'default', size = 'text-[64px]', className = '' }: LogoProps) {
  const variants: Record<string, [string, string]> = {
    default: ['text-[#5ce1e6]', 'text-[#5100a2]'],
    quiz: ['text-blue-500 drop-shadow-xl', 'text-fuchsia-600'],
    auth: ['text-[#70e0dc]', 'text-[#6a1b9a]'],
    storiesmain: ['text-[#1000c8]', 'text-purple-800'],
  };

  const [apre, nova] = variants[variant] || variants.default;

  return (
    <h1 className={`font-bold font-[Alice] leading-none ${size} ${className}`}>
      <span className={apre}>Apre</span>
      <span className={nova}>Nova</span>
    </h1>
  );
}
