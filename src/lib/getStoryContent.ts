// /src/lib/getStoryContent.ts

export async function getStoryContent(
  storySlug: string,
  level: string,
  part: string,
  lang: "es" | "en"
) {
  try {
    const file = await import(
      `../content/${storySlug}/${level}/${part}.${lang}.ts`
    );
    return file.default; // 🛠️ use `default` instead of `lines`
  } catch (err) {
    console.error("Failed to load story content:", err);
    return [{ en: "Content not available.", es: "Contenido no disponible." }];
  }
}
