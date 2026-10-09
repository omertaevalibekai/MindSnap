import { handleMessage } from "./message-router";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "mindsnap-snap", title: "Snap with MindSnap", contexts: ["page", "selection"] });
});

chrome.contextMenus.onClicked.addListener(async (_, tab) => {
  if (!tab?.id) return;
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.action.onClicked.addListener(async (tab) => {
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
  let resolved = false;
  const done = (payload: { ok: boolean; result?: unknown; error?: string }) => {
    if (resolved) return;
    resolved = true;
    sendResponse(payload);
  };

  const timeout = setTimeout(() => {
    done({
      ok: false,
      error: "Background timeout while handling message (120s). The AI request took too long."
    });
  }, 120000);

  Promise.resolve(handleMessage(message))
    .then((result) => done({ ok: true, result }))
    .catch((error) => done({ ok: false, error: String(error) }))
    .finally(() => clearTimeout(timeout));

  return true;
});

