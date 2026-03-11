const DEFAULT_SPEED = 1;

const applySpeedToTab = (tabId, speed) => {
  chrome.scripting.executeScript({
    target: { tabId },
    func: (speed) => {
      const video = document.querySelector("video");
      if (video) video.playbackRate = speed;
    },
    args: [speed],
  });
};

// Reset speed to 1× whenever YouTube reloads or navigates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url?.includes("youtube.com")) return;
  if (changeInfo.status !== "complete") return;

  applySpeedToTab(tabId, DEFAULT_SPEED);
});

// Handle popup speed changes
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "SET_SPEED") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs[0]?.id;
      if (tabId) applySpeedToTab(tabId, msg.speed);
    });
  }
});

