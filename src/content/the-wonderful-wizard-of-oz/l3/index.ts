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
import { chapterContent as ch13 } from "./ch13";
import { chapterContent as ch14 } from "./ch14";
import { chapterContent as ch15 } from "./ch15";
import { chapterContent as ch16 } from "./ch16";
import { chapterContent as ch17 } from "./ch17";
import { chapterContent as ch18 } from "./ch18";
import { chapterContent as ch19 } from "./ch19";
import { chapterContent as ch20 } from "./ch20";
import { chapterContent as ch21 } from "./ch21";
import { chapterContent as ch22 } from "./ch22";
import { chapterContent as ch23 } from "./ch23";
import { chapterContent as ch24 } from "./ch24";

export const levelContent = {
  storySlug: "the-wonderful-wizard-of-oz",
  level: 3,
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
  13: { pages: ch13.pages },
  14: { pages: ch14.pages },
  15: { pages: ch15.pages },
  16: { pages: ch16.pages },
  17: { pages: ch17.pages },
  18: { pages: ch18.pages },
  19: { pages: ch19.pages },
  20: { pages: ch20.pages },
  21: { pages: ch21.pages },
  22: { pages: ch22.pages },
  23: { pages: ch23.pages },
  24: { pages: ch24.pages },
  },
};

export default levelContent;

// Export chapter count for lazy loading
export const chapterCount = 24;

// Export function to dynamically load a single chapter
export async function loadChapter(chapterNum: number) {
  const module = await import(`./ch${chapterNum}`);
  return module.chapterContent;
}
