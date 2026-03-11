const SOURCE = "yt-speed-ext";

chrome.runtime.sendMessage({ type: "INJECT_MAIN" });

let cachedState = null;
let requestCounter = 0;
const pending = new Map();

const makeRequestId = () => `r${Date.now()}_${requestCounter++}`;

const requestMain = (type, payload = {}) =>
  new Promise((resolve) => {
    const requestId = makeRequestId();
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      resolve(null);
    }, 800);

    pending.set(requestId, (state) => {
      clearTimeout(timeout);
      pending.delete(requestId);
      resolve(state ?? null);
    });

    window.postMessage({ source: SOURCE, requestId, type, ...payload }, "*");
  });

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || data.source !== SOURCE) return;

  if (data.type === "STATE") {
    cachedState = data.state ?? null;
    if (cachedState) chrome.runtime.sendMessage({ type: "YT_STATE", state: cachedState });
    return;
  }

  if (data.type === "STATE_RESPONSE") {
    const fn = pending.get(data.requestId);
    if (fn) fn(data.state);
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_STATE") {
    requestMain("GET_STATE").then((state) => {
      sendResponse(state ?? cachedState);
    });
    return true;
  }

  if (message?.type === "SET_SPEED") {
    requestMain("SET_SPEED", { speed: message.speed }).then((state) => {
      sendResponse(state ?? cachedState);
    });
    return true;
  }

  if (message?.type === "SET_VOLUME") {
    requestMain("SET_VOLUME", { volumePercent: message.volumePercent }).then((state) => {
      sendResponse(state ?? cachedState);
    });
    return true;
  }
});
