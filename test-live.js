const url1 = "https://aisefarim.com/?video=5ux56lNHj5upf3hjfaJ2";
const url2 = "https://aisefarim.com/api/preview?video=5ux56lNHj5upf3hjfaJ2";

async function test() {
  try {
    console.log("Testing direct URL (should be rewritten):", url1);
    const res1 = await fetch(url1);
    const html1 = await res1.text();
    const title1 = html1.match(/<title>(.*?)<\/title>/);
    console.log("Title 1:", title1 ? title1[1] : null);

    console.log("\nTesting API directly:", url2);
    const res2 = await fetch(url2);
    const html2 = await res2.text();
    const title2 = html2.match(/<title>(.*?)<\/title>/);
    console.log("Title 2:", title2 ? title2[1] : null);
  } catch (e) {
    console.error(e);
  }
}
test();
