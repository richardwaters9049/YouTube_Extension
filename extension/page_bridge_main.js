(() => {
  if (window.__ytSpeedExtBridgeInstalled) return;
  window.__ytSpeedExtBridgeInstalled = true;

  const SOURCE = "yt-speed-ext";

  const getPlayer = () => {
    const player = document.getElementById("movie_player");
    return player && typeof player === "object" ? player : null;
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

  const safeCall = (obj, fnName, ...args) => {
    try {
      const fn = obj?.[fnName];
      if (typeof fn !== "function") return undefined;
      return fn.apply(obj, args);
    } catch {
      return undefined;
    }
  };

  const getState = () => {
    const player = getPlayer();
    const video = getVideo();
    if (!player && !video) return null;

    const playbackRate =
      safeCall(player, "getPlaybackRate") ?? video?.playbackRate ?? null;

    const volumePercent =
      safeCall(player, "getVolume") ?? (video ? video.volume * 100 : null);

    const muted = safeCall(player, "isMuted") ?? video?.muted ?? null;

    return {
      playbackRate,
      volumePercent,
      muted,
      url: location.href,
    };
  };

  const applySpeed = (speed) => {
    const player = getPlayer();
    const did = safeCall(player, "setPlaybackRate", speed);
    if (did !== undefined) return;

    const video = getVideo();
    if (video) video.playbackRate = speed;
  };

  const applyVolumePercent = (volumePercent) => {
    const player = getPlayer();
    const did = safeCall(player, "setVolume", volumePercent);
    if (did !== undefined) return;

    const video = getVideo();
    if (!video) return;
    const v = Math.min(1, Math.max(0, volumePercent / 100));
    video.volume = v;
  };

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE) return;

    const { requestId, type } = data;
    if (!requestId || typeof requestId !== "string") return;

    if (type === "GET_STATE") {
      window.postMessage(
        { source: SOURCE, type: "STATE_RESPONSE", requestId, state: getState() },
        "*",
      );
      return;
    }

    if (type === "SET_SPEED") {
      applySpeed(data.speed);
      window.postMessage(
        { source: SOURCE, type: "STATE_RESPONSE", requestId, state: getState() },
        "*",
      );
      return;
    }

    if (type === "SET_VOLUME") {
      applyVolumePercent(data.volumePercent);
      window.postMessage(
        { source: SOURCE, type: "STATE_RESPONSE", requestId, state: getState() },
        "*",
      );
      return;
    }
  });

  let lastSent = null;
  setInterval(() => {
    const state = getState();
    if (!state) return;
    const key = JSON.stringify({
      playbackRate: state.playbackRate,
      volumePercent: state.volumePercent,
      muted: state.muted,
      url: state.url,
    });
    if (key === lastSent) return;
    lastSent = key;
    window.postMessage({ source: SOURCE, type: "STATE", state }, "*");
  }, 500);
})();

