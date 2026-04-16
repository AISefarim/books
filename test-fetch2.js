const url = "https://aisefarim.com/api/preview?video=c78BCcl0tBfN1xP0esxd";
fetch(url)
  .then(res => res.text())
  .then(html => {
    const ogTags = html.match(/<meta[^>]*property="og:[^>]*>/g);
    console.log("OG Tags found:", ogTags);
    const title = html.match(/<title>(.*?)<\/title>/);
    console.log("Title found:", title ? title[1] : null);
  })
  .catch(err => console.error(err));
