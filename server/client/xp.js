const API_BASE = "";

const ytUrl = document.getElementById("ytUrl");
const lang = document.getElementById("lang");
const btnFetch = document.getElementById("btnFetch");
const btnCopy = document.getElementById("btnCopy");
const btnDownload = document.getElementById("btnDownload");
const btnClear = document.getElementById("btnClear");

const status = document.getElementById("status");
const sbLeft = document.getElementById("sbLeft");
const sbRight = document.getElementById("sbRight");

const outPlain = document.getElementById("outPlain");
const outSrt = document.getElementById("outSrt");
const tsBody = document.getElementById("tsBody");
const outTimestamps = document.getElementById("outTimestamps");

const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = {
  plain: outPlain,
  timestamps: outTimestamps,
  srt: outSrt
};

function setStatus(msg, isError=false){
  status.textContent = msg;
  sbLeft.textContent = isError ? "Error" : "OK";
}

function fmtTime(ms){
  const total = Math.max(0, Math.floor(ms));
  const s = Math.floor(total / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function activeTabKey(){
  return tabs.find(t => t.classList.contains("active"))?.dataset.tab || "plain";
}

function setActiveTab(key){
  tabs.forEach(t => t.classList.toggle("active", t.dataset.tab === key));
  Object.entries(panels).forEach(([k, el]) => el.classList.toggle("show", k === key));
}

tabs.forEach(t => t.addEventListener("click", () => setActiveTab(t.dataset.tab)));

async function fetchTranscript(){
  const input = ytUrl.value.trim();
  if (!input) return setStatus("Please paste a YouTube URL or ID.", true);

  setStatus("Fetching transcript…");
  btnFetch.disabled = true;

  try{
    const url = `${API_BASE}/api/transcript?url=${encodeURIComponent(input)}&lang=${encodeURIComponent(lang.value)}`;
    sbRight.textContent = url;

    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok){
      throw new Error(data?.error || "Failed to fetch transcript.");
    }

    outPlain.value = data.text || "";
    outSrt.value = data.srt || "";

    tsBody.innerHTML = "";
    (data.items || []).forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "ts-row";
      row.innerHTML = `
        <div>${idx + 1}</div>
        <div>${fmtTime(it.offset)}</div>
        <div>${escapeHtml(it.text)}</div>
      `;
      tsBody.appendChild(row);
    });

    setStatus(`Loaded transcript (${(data.items||[]).length} lines).`);
  } catch(e){
    outPlain.value = "";
    outSrt.value = "";
    tsBody.innerHTML = "";
    setStatus(e.message, true);
  } finally{
    btnFetch.disabled = false;
  }
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

btnFetch.addEventListener("click", fetchTranscript);
ytUrl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") fetchTranscript();
});

btnCopy.addEventListener("click", async () => {
  const key = activeTabKey();
  let text = "";
  if (key === "plain") text = outPlain.value;
  if (key === "srt") text = outSrt.value;
  if (key === "timestamps") {
    text = Array.from(tsBody.querySelectorAll(".ts-row"))
      .map(r => {
        const cells = r.querySelectorAll("div");
        return `[${cells[1].textContent}] ${cells[2].textContent}`;
      })
      .join("\n");
  }
  await navigator.clipboard.writeText(text);
  setStatus("Copied to clipboard.");
});

btnDownload.addEventListener("click", () => {
  const key = activeTabKey();
  const text = key === "srt" ? outSrt.value : outPlain.value;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = key === "srt" ? "transcript.srt" : "transcript.txt";
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("Downloaded.");
});

btnClear.addEventListener("click", () => {
  ytUrl.value = "";
  outPlain.value = "";
  outSrt.value = "";
  tsBody.innerHTML = "";
  setStatus("Cleared.");
});

setActiveTab("plain");
setStatus("Ready.");
