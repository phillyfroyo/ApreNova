// Migrate story slugs in the DB after the code/content rename.
//   the-great-gatsby-a-8 -> the-great-gatsby
//   my-day-3             -> my-day
//
// Default mode is DRY RUN (reports what it WOULD do, writes nothing).
// Pass --execute to actually perform the writes inside a transaction.
//
//   node scripts/migrate-story-slugs.mjs            # dry run
//   node scripts/migrate-story-slugs.mjs --execute  # real migration
//
// Merge rule on unique-constrained tables (storyBookmark @@unique(userId,storySlug);
// pageVisit @@unique(userId,storySlug,level,chapter,page)): the DIRTY-slug row
// is the current/live data and WINS. On collision we delete the stale
// clean-slug duplicate, then rename the dirty row in. All other tables have no
// unique key on storySlug, so a flat updateMany is safe.
//
// Safe to delete after the migration has run in prod.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const EXECUTE = process.argv.includes("--execute");
const PAIRS = [
  ["the-great-gatsby-a-8", "the-great-gatsby"],
  ["my-day-3", "my-day"],
];

// Tables with NO unique constraint involving storySlug -> flat update is safe.
const FLAT_MODELS = [
  "completedStory",     // @@unique includes slug, but collision count = 0 (verified). Handled as merge anyway for safety below.
  "storyTutorMessage",
  "sessionLog",
  "savedWord",
  "audioGenerationJob",
  "ttsGenerationStat",
];
// completedStory DOES have a slug in its unique key, so treat it as a merge
// table too (its measured collisions were 0, but be defensive).
const MERGE_MODELS = {
  storyBookmark: { keyFields: ["userId"] },
  pageVisit: { keyFields: ["userId", "level", "chapter", "page"] },
  completedStory: { keyFields: ["userId", "level", "chapter", "page"] },
};
// Remove completedStory from FLAT to avoid double-processing.
const FLAT_ONLY = FLAT_MODELS.filter((m) => !(m in MERGE_MODELS));

function keyOf(row, fields) {
  return fields.map((f) => row[f]).join("|");
}

async function plan() {
  const report = [];
  for (const [dirty, clean] of PAIRS) {
    const pair = { dirty, clean, flat: {}, merge: {} };

    for (const model of FLAT_ONLY) {
      pair.flat[model] = await prisma[model].count({ where: { storySlug: dirty } });
    }

    for (const [model, { keyFields }] of Object.entries(MERGE_MODELS)) {
      const sel = Object.fromEntries(keyFields.map((f) => [f, true]));
      const dirtyRows = await prisma[model].findMany({ where: { storySlug: dirty }, select: { id: true, ...sel } });
      const cleanRows = await prisma[model].findMany({ where: { storySlug: clean }, select: { id: true, ...sel } });
      const cleanByKey = new Map(cleanRows.map((r) => [keyOf(r, keyFields), r.id]));
      const collidingCleanIds = [];
      for (const r of dirtyRows) {
        const hit = cleanByKey.get(keyOf(r, keyFields));
        if (hit) collidingCleanIds.push(hit);
      }
      pair.merge[model] = {
        dirtyCount: dirtyRows.length,
        cleanCount: cleanRows.length,
        deleteCleanIds: collidingCleanIds,
      };
    }
    report.push(pair);
  }
  return report;
}

async function run() {
  const report = await plan();

  console.log(`\n=== Story slug DB migration — ${EXECUTE ? "EXECUTE" : "DRY RUN"} ===`);
  for (const p of report) {
    console.log(`\n${p.dirty}  →  ${p.clean}`);
    for (const [m, n] of Object.entries(p.flat)) {
      console.log(`  [flat ] ${m.padEnd(18)} update ${n} row(s)`);
    }
    for (const [m, info] of Object.entries(p.merge)) {
      console.log(
        `  [merge] ${m.padEnd(18)} dirty=${info.dirtyCount} clean=${info.cleanCount} ` +
          `→ delete ${info.deleteCleanIds.length} colliding clean row(s), then rename dirty`
      );
    }
  }

  if (!EXECUTE) {
    console.log("\nDRY RUN — no changes written. Re-run with --execute to apply.\n");
    await prisma.$disconnect();
    return;
  }

  console.log("\nApplying inside a transaction...");
  await prisma.$transaction(async (tx) => {
    for (const p of report) {
      const { dirty, clean } = p;

      // Flat tables: straight rename.
      for (const model of FLAT_ONLY) {
        const res = await tx[model].updateMany({
          where: { storySlug: dirty },
          data: { storySlug: clean },
        });
        console.log(`  ${model}: renamed ${res.count}`);
      }

      // Merge tables: delete colliding clean rows (dirty wins), then rename dirty.
      for (const [model, info] of Object.entries(p.merge)) {
        const ids = info.deleteCleanIds;
        if (ids.length) {
          const del = await tx[model].deleteMany({ where: { id: { in: ids } } });
          console.log(`  ${model}: deleted ${del.count} stale clean duplicate(s)`);
        }
        const res = await tx[model].updateMany({
          where: { storySlug: dirty },
          data: { storySlug: clean },
        });
        console.log(`  ${model}: renamed ${res.count}`);
      }
    }
  });

  // Post-check: no dirty slugs remain anywhere.
  console.log("\nPost-migration verification:");
  for (const [dirty] of PAIRS) {
    for (const model of [...FLAT_ONLY, ...Object.keys(MERGE_MODELS)]) {
      const left = await prisma[model].count({ where: { storySlug: dirty } });
      if (left > 0) console.log(`  !! ${model} still has ${left} rows with "${dirty}"`);
    }
  }
  console.log("  done (no output above = fully clean).\n");
  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error("MIGRATION FAILED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
