import { parseGeneric } from "./page-detector";
import { getSelectionText } from "./selection-handler";

chrome.runtime.onMessage.addListener((message, _, sendResponse) => {
  if (message?.type === "PARSE_PAGE") {
    const parsed = parseGeneric();
    const selected = getSelectionText();
    if (selected.length >= 40) {
      sendResponse({
        ...parsed,
        selectedText: selected,
        text: selected
      });
      return true;
    }
    sendResponse(parsed);
    return true;
  }
  return false;
});

