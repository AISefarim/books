const functions = require("firebase-functions");
const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

app.get("*", async (req, res) => {
  try {
    // Read the index.html file that we will copy into the functions folder during build
    const indexPath = path.join(__dirname, "index.html");
    let template = fs.readFileSync(indexPath, "utf-8");

    const videoId = req.query.video;
    const bookId = req.query.book;
    
    let ogTitle = null;
    let ogDesc = null;
    let ogImage = null;

    if (videoId) {
      try {
        const response = await fetch(`https://firestore.googleapis.com/v1/projects/ai-sefarim/databases/(default)/documents/artifacts/ai-sefarim/public/data/sefarim/${videoId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.fields && data.fields.type && data.fields.type.stringValue === 'video') {
            const title = data.fields.title?.stringValue || 'Video';
            const category = data.fields.category?.stringValue || 'Category';
            ogTitle = `${category} : ${title}`;
            ogDesc = `Watch ${title} from the ${category} category on AI Sefarim.`;
            
            try {
              const settingsResponse = await fetch(`https://firestore.googleapis.com/v1/projects/ai-sefarim/databases/(default)/documents/artifacts/ai-sefarim/public/data/sefarim/_site_settings_`);
              if (settingsResponse.ok) {
                const settingsData = await settingsResponse.json();
                if (settingsData.fields?.videoCategoryThumbnails?.mapValue?.fields) {
                  const thumbnails = settingsData.fields.videoCategoryThumbnails.mapValue.fields;
                  if (thumbnails[category]?.stringValue) {
                    ogImage = thumbnails[category].stringValue;
                  }
                }
              }
            } catch (err) {
              console.error("Error fetching settings metadata:", err);
            }
          }
        }
      } catch (err) {
        console.error("Error fetching video metadata:", err);
      }
    } else if (bookId) {
      try {
        const response = await fetch(`https://firestore.googleapis.com/v1/projects/ai-sefarim/databases/(default)/documents/artifacts/ai-sefarim/public/data/sefarim/${bookId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.fields && (!data.fields.type || data.fields.type.stringValue !== 'video')) {
            const title = data.fields.title?.stringValue || 'Sefer';
            const author = data.fields.author?.stringValue || 'Author';
            ogTitle = `${title} by ${author}`;
            ogDesc = data.fields.desc?.stringValue || `Read and download ${title} on AI Sefarim.`;
          }
        }
      } catch (err) {
        console.error("Error fetching book metadata:", err);
      }
    }

    if (ogTitle && ogDesc) {
      template = template.replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${ogTitle}" />`);
      template = template.replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${ogDesc}" />`);
      template = template.replace(/<title>.*<\/title>/, `<title>${ogTitle}</title>`);
      if (ogImage) {
        template = template.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${ogImage}" />`);
      }
    }

    res.status(200).set({ "Content-Type": "text/html", "Cache-Control": "public, max-age=300, s-maxage=600" }).end(template);
  } catch (e) {
    console.error(e);
    res.status(500).send("Internal Server Error");
  }
});

// Export the Express app as a Firebase Function
exports.ssr = functions.https.onRequest(app);
