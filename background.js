"use strict";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "rk-copy-session",
    title: "この予定をコピー",
    contexts: ["link"],
    documentUrlPatterns: ["https://rubykaigi.org/2026/schedule/*"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "rk-copy-session") {
    chrome.tabs.sendMessage(tab.id, {
      type: "copy-session",
      linkUrl: info.linkUrl,
    });
  }
});
