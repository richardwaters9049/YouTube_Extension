const getVideo = () =>
  document.querySelector("video.html5-main-video") ||
  document.querySelector("video");

const getState = () => {
  const video = getVideo();
  if (!video) return null;

  return {
    playbackRate: video.playbackRate,
    volumePercent: video.volume * 100,
    muted: video.muted,
    url: location.href,
  };
};

const sendState = () => {
  const state = getState();
  if (!state) return;
  chrome.runtime.sendMessage({ type: "YT_STATE", state });
};

const applySpeed = (speed) => {
  const video = getVideo();
  if (video) video.playbackRate = speed;
};

const applyVolumePercent = (volumePercent) => {
  const video = getVideo();
  if (!video) return;
  const v = Math.min(1, Math.max(0, volumePercent / 100));
  video.volume = v;
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "GET_STATE") {
    sendResponse(getState());
    return true;
  }

  if (message?.type === "SET_SPEED") {
    applySpeed(message.speed);
    sendResponse(getState());
    return true;
  }

  if (message?.type === "SET_VOLUME") {
    applyVolumePercent(message.volumePercent);
    sendResponse(getState());
    return true;
  }
});

let attachedVideo = null;

const attachToVideo = () => {
  const video = getVideo();
  if (!video || video === attachedVideo) return;

  attachedVideo?.removeEventListener("ratechange", sendState);
  attachedVideo?.removeEventListener("volumechange", sendState);

  attachedVideo = video;
  attachedVideo.addEventListener("ratechange", sendState);
  attachedVideo.addEventListener("volumechange", sendState);

  sendState();
};

attachToVideo();
new MutationObserver(attachToVideo).observe(document.documentElement, {
  childList: true,
  subtree: true,
});
