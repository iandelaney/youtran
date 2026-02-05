import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { YoutubeTranscript } from "youtube-transcript";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the XP frontend
const clientDir = path.join(__dirname, "client");
app.use(express.static(clientDir));

function extractVideoId(input) {
  // Accept raw ID, youtu.be, watch?v=, shorts, embed
  try {
    // If it's already an 11-char-ish id, just return it
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

    const url = new URL(input);
    const host = url.hostname.replace("www.", "");

    if (host === "youtu.be") return url.pathname.slice(1);
    if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2];
    if (url.pathname.startsWith("/embed/")) return url.pathname.split("/")[2];

    const v = url.searchParams.get("v");
    if (v) return v;

    return null;
  } catch {
    return null;
  }
}

app.get("/api/transcript", async (req, res) => {
  const { url, lang = "en" } = req.query;
  if (!url) return res.status(400).json({ error: "Missing ?url=" });

  const videoId = extractVideoId(String(url));
  if (!videoId) return res.status(400).json({ error: "Could not parse YouTube video ID." });

  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: String(lang) });

    // items: [{text, duration, offset}, ...]
    const text = items.map(x => x.text).join(" ").replace(/\s+/g, " ").trim();

    const srt = items
      .map((x, i) => {
        const start = x.offset;
        const end = x.offset + x.duration;

        const fmt = (ms) => {
          const total = Math.max(0, Math.floor(ms));
          const hh = String(Math.floor(total / 3600000)).padStart(2, "0");
          const mm = String(Math.floor((total % 3600000) / 60000)).padStart(2, "0");
          const ss = String(Math.floor((total % 60000) / 1000)).padStart(2, "0");
          const mmm = String(total % 1000).padStart(3, "0");
          return `${hh}:${mm}:${ss},${mmm}`;
        };

        return `${i + 1}\n${fmt(start)} --> ${fmt(end)}\n${x.text}\n`;
      })
      .join("\n");

    res.json({ videoId, lang: String(lang), items, text, srt });
  } catch (e) {
    res.status(404).json({
      error: "Transcript not available for this video (or blocked/disabled).",
      details: String(e?.message ?? e)
    });
  }
});

// Any other route: return the frontend (so refresh works)
app.get("*", (req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => {
  console.log(`XP Transcriber running on http://localhost:${PORT}`);
});
