export default async function handler(req, res) {
  try {
    const host = req.headers.host || 'aisefarim.com';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    
    // Fetch the actual static index.html from the deployment
    const htmlRes = await fetch(`${protocol}://${host}/index.html`);
    let html = await htmlRes.text();

    const videoId = req.query.video;
    const bookId = req.query.book;
    
    let ogTitle = null;
    let ogDesc = null;
    let ogImage = null;

    if (videoId || bookId) {
      // Authenticate anonymously to bypass Firebase security rules
      const apiKey = "AIzaSyDxPMAW_pa1GBggo6swF348it_bdu71kZQ";
      const projectId = "ai-sefarim";
      
      const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnSecureToken: true })
      });
      const authData = await authRes.json();
      const idToken = authData.idToken;

      if (idToken) {
        if (videoId) {
          try {
            const dbRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/ai-sefarim/public/data/sefarim/${videoId}`, {
              headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const dbData = await dbRes.json();
            
            if (dbData.fields && dbData.fields.type && dbData.fields.type.stringValue === 'video') {
              const title = dbData.fields.title?.stringValue || 'Video';
              const category = dbData.fields.category?.stringValue || 'Category';
              ogTitle = `${category} : ${title}`;
              ogDesc = `Watch ${title} from the ${category} category on AI Sefarim.`;
              
              try {
                const settingsRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/ai-sefarim/public/data/sefarim/_site_settings_`, {
                  headers: { 'Authorization': `Bearer ${idToken}` }
                });
                const settingsData = await settingsRes.json();
                if (settingsData.fields?.videoCategoryThumbnails?.mapValue?.fields) {
                  const thumbnails = settingsData.fields.videoCategoryThumbnails.mapValue.fields;
                  if (thumbnails[category]?.stringValue) {
                    ogImage = thumbnails[category].stringValue;
                  }
                }
              } catch (err) {
                console.error("Error fetching settings metadata:", err);
              }
            }
          } catch (err) {
            console.error("Error fetching video metadata:", err);
          }
        } else if (bookId) {
          try {
            const dbRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/artifacts/ai-sefarim/public/data/sefarim/${bookId}`, {
              headers: { 'Authorization': `Bearer ${idToken}` }
            });
            const dbData = await dbRes.json();
            
            if (dbData.fields && (!dbData.fields.type || dbData.fields.type.stringValue !== 'video')) {
              const title = dbData.fields.title?.stringValue || 'Sefer';
              const author = dbData.fields.author?.stringValue || 'Author';
              ogTitle = `${title} by ${author}`;
              ogDesc = dbData.fields.desc?.stringValue || `Read and download ${title} on AI Sefarim.`;
            }
          } catch (err) {
            console.error("Error fetching book metadata:", err);
          }
        }
      }
    }

    if (ogTitle && ogDesc) {
      // Escape for HTML output
      const esTitle = ogTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const esDesc = ogDesc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      
      html = html.replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/, `<meta property="og:title" content="${esTitle}" />\n    <meta name="twitter:title" content="${esTitle}" />`);
      html = html.replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/, `<meta property="og:description" content="${esDesc}" />\n    <meta name="twitter:description" content="${esDesc}" />\n    <meta name="twitter:card" content="summary_large_image" />`);
      html = html.replace(/<title>.*<\/title>/, `<title>${esTitle}</title>`);
      if (ogImage) {
        const escapedOgImage = ogImage.replace(/&/g, '&amp;');
        html = html.replace(/<meta\s+property="og:image"\s+content="[^"]*"\s*\/>/, `<meta property="og:image" content="${escapedOgImage}" />\n    <meta name="twitter:image" content="${escapedOgImage}" />\n    <meta property="og:image:alt" content="${esTitle}" />`);
        // Force the thumbnail to also override the apple-touch-icon so it has no choice but to show the category thumbnail
        html = html.replace(/<link\s+rel="apple-touch-icon"\s+href="[^"]*"\s*\/>/, `<link rel="apple-touch-icon" href="${escapedOgImage}" />`);
      }
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.status(200).send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send("Internal Server Error");
  }
}
