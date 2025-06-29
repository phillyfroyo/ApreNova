'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface Props {
  href: string;
  children: React.ReactNode;
}

export default function LinkWithTransition({ href, children }: Props) {
  const router = useRouter();
  const [clicked, setClicked] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (clicked) return;
    setClicked(true);

    // delay to allow exit animation
    setTimeout(() => {
      router.push(href);
    }, 400); // match transition.duration
  };

  return (
    <a href={href} onClick={handleClick}>
      {children}
    </a>
  );
}
