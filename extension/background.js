const stateByTabId = new Map();
const injectedTabs = new Set();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "INJECT_MAIN") {
    const tabId = sender?.tab?.id;
    if (tabId == null) return;
    if (injectedTabs.has(tabId)) return;

    injectedTabs.add(tabId);
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["page_bridge_main.js"],
      world: "MAIN",
    });
    return;
  }

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
  injectedTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "loading") return;
  if (!tab.url?.includes("youtube.com")) return;
  injectedTabs.delete(tabId);
});
