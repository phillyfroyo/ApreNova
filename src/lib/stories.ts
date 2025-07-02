import type { StoryMetadata } from "@/types/story";

export const STORY_METADATA: StoryMetadata[] = [

  {
    title: "La Aventura",
    image: "/images/aventura-thumbnail.png",
    levels: ["l1", "l2", "l3", "l4", "l5"],
    description: "Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles. Una serie de aventuras en Latinoamérica, perfecta para todos los niveles."
  },
  {
    title: "El Bosque Perdido",
    image: "/images/placeholder1.png",
    levels: ["l2"],
    description: "Misterios y criaturas ocultas en un bosque encantado."
  },
  {
    title: "Misterio en la Selva",
    image: "/images/placeholder2.png",
    levels: ["l3"],
    description: "Un arqueólogo desaparece en la selva profunda..."
  },
  {
    title: "El Viaje Mágico",
    image: "/images/placeholder3.png",
    levels: ["l4"],
    description: "Un tren, un mapa antiguo, y una puerta a otro mundo."
  },
  {
    title: "Secretos del Desierto",
    image: "/images/placeholder4.png",
    levels: ["l5"],
    description: "El pasado cobra vida entre las dunas del desierto."
  },
];
export function getStoryUrl({
  locale,
  storySlug,
  level,
  part = 1
}: {
  locale: string;
  storySlug: string;
  level: string;
  part?: number;
}) {
  return `/${locale}/stories/${storySlug}/${level}/part-${part}`;
}
