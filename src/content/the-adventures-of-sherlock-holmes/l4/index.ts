// Auto-generated index file for split chapter format
import { chapterContent as ch1 } from "./ch1";
import { chapterContent as ch2 } from "./ch2";
import { chapterContent as ch3 } from "./ch3";
import { chapterContent as ch4 } from "./ch4";
import { chapterContent as ch5 } from "./ch5";
import { chapterContent as ch6 } from "./ch6";
import { chapterContent as ch7 } from "./ch7";
import { chapterContent as ch8 } from "./ch8";
import { chapterContent as ch9 } from "./ch9";
import { chapterContent as ch10 } from "./ch10";
import { chapterContent as ch11 } from "./ch11";
import { chapterContent as ch12 } from "./ch12";

export const levelContent = {
  storySlug: "the-adventures-of-sherlock-holmes",
  level: 4,
  hasChapters: true,
  chapters: {
  1: { pages: ch1.pages },
  2: { pages: ch2.pages },
  3: { pages: ch3.pages },
  4: { pages: ch4.pages },
  5: { pages: ch5.pages },
  6: { pages: ch6.pages },
  7: { pages: ch7.pages },
  8: { pages: ch8.pages },
  9: { pages: ch9.pages },
  10: { pages: ch10.pages },
  11: { pages: ch11.pages },
  12: { pages: ch12.pages },
  },
};

export default levelContent;

// Export chapter count for lazy loading
export const chapterCount = 12;

// Export function to dynamically load a single chapter
export async function loadChapter(chapterNum: number) {
  const module = await import(`./ch${chapterNum}`);
  return module.chapterContent;
}
