import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  let vite;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, { index: false })); // Disable index.html auto-serving so we can intercept it
  }

  app.get("*", async (req, res) => {
    try {
      let template;
      if (process.env.NODE_ENV !== "production") {
        template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
      } else {
        template = fs.readFileSync(path.resolve(process.cwd(), "dist/index.html"), "utf-8");
      }

      // Check for video or book query parameter
      const videoId = req.query.video;
      const bookId = req.query.book;
      
      let ogTitle = null;
      let ogDesc = null;

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
        // Replace OG tags
        template = template.replace(
          /<meta property="og:title" content="[^"]*" \/>/,
          `<meta property="og:title" content="${ogTitle}" />`
        );
        template = template.replace(
          /<meta property="og:description" content="[^"]*" \/>/,
          `<meta property="og:description" content="${ogDesc}" />`
        );
        template = template.replace(
          /<title>.*<\/title>/,
          `<title>${ogTitle}</title>`
        );
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      if (vite) {
        vite.ssrFixStacktrace(e);
      }
      console.error(e);
      res.status(500).end(e.message);
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
