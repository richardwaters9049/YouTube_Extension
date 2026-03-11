const getPlayer = () => {
  const player = document.getElementById("movie_player");
  if (player && typeof player === "object") return player;
  return null;
};

const pickBestVideo = () => {
  const videos = Array.from(document.querySelectorAll("video"));
  if (videos.length === 0) return null;

  const scored = videos
    .map((video) => {
      const r = video.getBoundingClientRect();
      const area = Math.max(0, r.width) * Math.max(0, r.height);
      return { video, area };
    })
    .sort((a, b) => b.area - a.area);

  return scored[0]?.video ?? null;
};

const getVideo = () =>
  document.querySelector("#movie_player video.html5-main-video") ||
  document.querySelector("video.html5-main-video") ||
  pickBestVideo();

const getState = () => {
  const player = getPlayer();
  const video = getVideo();
  if (!player && !video) return null;

  const playbackRate =
    player && typeof player.getPlaybackRate === "function"
      ? player.getPlaybackRate()
      : video?.playbackRate;

  const volumePercent =
    player && typeof player.getVolume === "function"
      ? player.getVolume()
      : video != null
        ? video.volume * 100
        : null;

  const muted =
    player && typeof player.isMuted === "function"
      ? player.isMuted()
      : video?.muted;

  return {
    playbackRate,
    volumePercent,
    muted,
    url: location.href,
  };
};

const sendState = () => {
  const state = getState();
  if (!state) return;
  chrome.runtime.sendMessage({ type: "YT_STATE", state });
};

const applySpeed = (speed) => {
  const player = getPlayer();
  if (player && typeof player.setPlaybackRate === "function") {
    player.setPlaybackRate(speed);
    return;
  }
  const video = getVideo();
  if (video) video.playbackRate = speed;
};

const applyVolumePercent = (volumePercent) => {
  const player = getPlayer();
  if (player && typeof player.setVolume === "function") {
    player.setVolume(volumePercent);
    return;
  }
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
let lastSent = null;

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

const pollState = () => {
  const state = getState();
  if (!state) return;

  const key = JSON.stringify({
    playbackRate: state.playbackRate,
    volumePercent: state.volumePercent,
    muted: state.muted,
    url: state.url,
  });

  if (key !== lastSent) {
    lastSent = key;
    chrome.runtime.sendMessage({ type: "YT_STATE", state });
  }
};

setInterval(pollState, 500);
