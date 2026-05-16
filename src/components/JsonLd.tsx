// src/components/JsonLd.tsx
// Renders JSON-LD structured data inline. Used at page or layout level to
// give Google/Bing rich-result metadata (Book, LearningResource, etc.).
//
// Pattern recommended by Next.js docs:
// https://nextjs.org/docs/app/guides/json-ld

interface JsonLdProps {
  data: object;
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify is safe to inline in a <script> tag; it can never
      // produce a </script> sequence from valid JSON.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
