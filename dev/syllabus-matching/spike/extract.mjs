import fs from 'fs';
const src = fs.readFileSync('src/content/the-adventures-of-sherlock-holmes/l3/ch1.ts','utf8');
const json = src.replace(/^export const chapterContent = /,'').replace(/;?\s*(export default[\s\S]*)?$/,'').trim().replace(/;$/,'');
const data = JSON.parse(json);
const out = [];
for (const [pageNum, page] of Object.entries(data.pages)) {
  (page.lines||[]).forEach((l,i)=>{
    out.push({page:Number(pageNum), lineIndex:i, en:l.en, es:l.es});
  });
}
fs.writeFileSync('dev/syllabus-matching/spike/ch1-l3.json', JSON.stringify(out,null,1));
console.log('pages:', Object.keys(data.pages).length, 'lines:', out.length);
console.log('words(en):', out.map(o=>o.en).join(' ').split(/\s+/).length);
