"use strict";

const ROOM_LABELS = ["A", "B", "C"];
const BASE_URL = "https://rubykaigi.org";

// --- Parsing ---

function parseSchedule() {
  const rows = document.querySelectorAll(".c-schedule-table__row");
  const entries = [];

  rows.forEach((row) => {
    const timeEl = row.querySelector(".c-schedule-table__time");
    if (!timeEl) return;

    const time = timeEl.textContent
      .replace(/\s+/g, " ")
      .trim()
      .replace(/ \u2013 /g, " - ");

    const cells = row.querySelectorAll(".c-schedule-table__event");

    if (
      cells.length === 1 &&
      cells[0].classList.contains("c-schedule-table__event--break")
    ) {
      return;
    }

    cells.forEach((cell, colIndex) => {
      const item = cell.querySelector(".c-schedule-item");
      if (!item) return;

      const title = item
        .querySelector(".c-schedule-item__title")
        ?.textContent.trim();
      const href = item
        .querySelector("a.c-schedule-item__inner")
        ?.getAttribute("href");
      if (!title || !href) return;

      const room = ROOM_LABELS[colIndex] || "?";
      const url = href.startsWith("http") ? href : BASE_URL + href;

      entries.push({ time, room, title, url });
    });
  });

  return entries;
}

// --- Formatting ---

function groupByTime(entries) {
  const groups = [];
  let lastTime = null;
  let current = [];

  for (const e of entries) {
    if (e.time !== lastTime) {
      if (current.length > 0) groups.push(current);
      current = [];
      lastTime = e.time;
    }
    current.push(e);
  }
  if (current.length > 0) groups.push(current);

  return groups;
}

function entryToHTML(e) {
  const escaped = e.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `${e.time} ${e.room} <a href="${e.url}">${escaped}</a>`;
}

function entryToPlain(e) {
  return `${e.time} ${e.room} ${e.title} ${e.url}`;
}

function toHTML(entries) {
  const groups = groupByTime(entries);
  return groups
    .map((group) => group.map(entryToHTML).join("<br>"))
    .join("<br><br>");
}

function toPlainText(entries) {
  const groups = groupByTime(entries);
  return groups
    .map((group) => group.map(entryToPlain).join("\n"))
    .join("\n\n");
}

// --- Clipboard ---

async function copyRichText(html, plain) {
  // Try Clipboard API first (requires focus + user activation)
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plain], { type: "text/plain" }),
      }),
    ]);
    return;
  } catch {
    // Fall through to execCommand fallback
  }

  // Fallback: select a temporary HTML element and execCommand("copy")
  // This preserves rich text (links) even without page focus
  const div = document.createElement("div");
  div.innerHTML = html;
  div.style.position = "fixed";
  div.style.left = "-9999px";
  div.style.whiteSpace = "pre-wrap";
  document.body.appendChild(div);

  const range = document.createRange();
  range.selectNodeContents(div);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  document.execCommand("copy");

  sel.removeAllRanges();
  document.body.removeChild(div);
}

// --- Copy All button ---

function detectDay() {
  const m = location.pathname.match(/day(\d)/);
  return m ? `Day ${m[1]}` : "Schedule";
}

function createButton() {
  const btn = document.createElement("button");
  btn.id = "rk-copy-btn";
  const label = `📋 Copy ${detectDay()}`;
  btn.textContent = label;
  document.body.appendChild(btn);

  btn.addEventListener("click", async () => {
    const entries = parseSchedule();
    if (entries.length === 0) {
      btn.textContent = "No sessions found";
      setTimeout(() => {
        btn.textContent = label;
      }, 2000);
      return;
    }

    await copyRichText(toHTML(entries), toPlainText(entries));

    btn.textContent = "✓ Copied";
    btn.classList.add("rk-copied");
    setTimeout(() => {
      btn.textContent = label;
      btn.classList.remove("rk-copied");
    }, 2000);
  });
}

// --- Right-click: copy single session ---

function findEntryByUrl(linkUrl) {
  const entries = parseSchedule();
  return entries.find((e) => linkUrl.endsWith(e.url.replace(BASE_URL, "")));
}

function showToast(message) {
  let toast = document.getElementById("rk-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "rk-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("rk-toast--visible");
  setTimeout(() => {
    toast.classList.remove("rk-toast--visible");
  }, 2000);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "copy-session") return;

  const entry = findEntryByUrl(msg.linkUrl);
  if (!entry) {
    showToast("✗ セッションが見つかりません");
    return;
  }

  copyRichText(entryToHTML(entry), entryToPlain(entry)).then(() => {
    showToast("✓ コピーしました");
  });
});

// --- Init ---

createButton();
