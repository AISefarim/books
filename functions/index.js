const functions = require("firebase-functions");
const express = require("express");
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

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
        const docRef = db.collection('artifacts').doc('ai-sefarim').collection('public').doc('data').collection('sefarim').doc(videoId);
        const docSnap = await docRef.get();
        
        if (docSnap.exists) {
          const data = docSnap.data();
          if (data.type === 'video') {
            const title = data.title || 'Video';
            const category = data.category || 'Category';
            ogTitle = `${category} : ${title}`;
            ogDesc = `Watch ${title} from the ${category} category on AI Sefarim.`;
            
            try {
              const settingsRef = db.collection('artifacts').doc('ai-sefarim').collection('public').doc('data').collection('sefarim').doc('_site_settings_');
              const settingsSnap = await settingsRef.get();
              if (settingsSnap.exists) {
                const settingsData = settingsSnap.data();
                if (settingsData.videoCategoryThumbnails && settingsData.videoCategoryThumbnails[category]) {
                  ogImage = settingsData.videoCategoryThumbnails[category];
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
        const docRef = db.collection('artifacts').doc('ai-sefarim').collection('public').doc('data').collection('sefarim').doc(bookId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data();
          if (data.type !== 'video') {
            const title = data.title || 'Sefer';
            const author = data.author || 'Author';
            ogTitle = `${title} by ${author}`;
            ogDesc = data.desc || `Read and download ${title} on AI Sefarim.`;
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
