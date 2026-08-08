// Pre-class smoke test — no Temporal server, no API key needed. Verifies the
// scraping half of the pipeline against the live site: sitemap reachable,
// bio pages downloadable, text extraction sane.
//
//   npm run smoke
import { fetchLawyerUrls, downloadBio } from "./activities";

async function run() {
  const urls = await fetchLawyerUrls(3);
  console.log(`sitemap OK — first ${urls.length} lawyer URLs:`);
  for (const url of urls) console.log(`  ${url}`);

  const text = await downloadBio(urls[0]);
  console.log(`\nbio download OK — ${text.length} chars of text. First 300:\n`);
  console.log(text.slice(0, 300));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
