export async function getStoryContent(
  storySlug: string,
  level: string,
  part: string,
  lang: "es" | "en"
) {
  try {
    const file = await import(
      `../content/${storySlug}/${level}/part-${part}.${lang}.ts`
    );
    return file.lines;
  } catch (err) {
    console.error("Failed to load story content:", err);
    return ["Contenido no disponible."];
  }
}
