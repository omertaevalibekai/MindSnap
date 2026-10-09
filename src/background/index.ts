import { handleMessage } from "./message-router";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "mindsnap-snap", title: "Snap with MindSnap", contexts: ["page", "selection"] });
});

chrome.contextMenus.onClicked.addListener(async (_, tab) => {
  if (!tab?.id) return;
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "snap-page") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) await chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));
  return true;
});

