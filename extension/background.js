const stateByTabId = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "YT_STATE") {
    const tabId = sender?.tab?.id;
    if (tabId != null) stateByTabId.set(tabId, msg.state);
    return;
  }

  if (msg?.type === "GET_LAST_STATE") {
    const tabId = msg.tabId;
    sendResponse(tabId != null ? stateByTabId.get(tabId) ?? null : null);
    return true;
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  stateByTabId.delete(tabId);
});
