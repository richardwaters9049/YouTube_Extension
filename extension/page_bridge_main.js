(() => {
  if (window.__ytSpeedExtBridgeInstalled) return;
  window.__ytSpeedExtBridgeInstalled = true;

  const SOURCE = "yt-speed-ext";
  const DEFAULT_SPEED = 1;
  const DEFAULT_VOLUME_PERCENT = 100;

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

  const normalizePlayerVolumePercent = (rawPlayerVolume, mediaVolumePercent) => {
    if (!Number.isFinite(rawPlayerVolume)) return null;

    // Some player methods report 0-1 while the media element uses 0-100%.
    if (
      rawPlayerVolume >= 0 &&
      rawPlayerVolume <= 1 &&
      Number.isFinite(mediaVolumePercent) &&
      mediaVolumePercent > 1.5
    ) {
      return rawPlayerVolume * 100;
    }

    return rawPlayerVolume;
  };

  const hasFractionalPercent = (value) =>
    Number.isFinite(value) && Math.abs(value - Math.round(value)) > 0.001;

  const requiresExactVolumeCompensation = (value) =>
    Number.isFinite(value) &&
    value > 0 &&
    value < 100 &&
    Math.abs(value % 5) > 0.001;

  let activeAudioGraph = null;
  let activeExactVolume = null;

  const ensureAudioGraph = async (video) => {
    if (!video) return null;
    if (activeAudioGraph?.video === video) {
      try {
        await activeAudioGraph.context.resume();
      } catch {}
      return activeAudioGraph;
    }

    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return null;

      const context = new AudioContextCtor();
      const source = context.createMediaElementSource(video);
      const gainNode = context.createGain();
      source.connect(gainNode);
      gainNode.connect(context.destination);
      await context.resume();

      activeAudioGraph = { video, context, source, gainNode };
      return activeAudioGraph;
    } catch {
      return null;
    }
  };

  const clearExactVolumeCompensation = () => {
    activeExactVolume = null;
    if (activeAudioGraph?.gainNode) {
      activeAudioGraph.gainNode.gain.value = 1;
    }
  };

  const getState = () => {
    const player = getPlayer();
    const video = getVideo();
    if (!player && !video) return null;

    const playbackRate =
      safeCall(player, "getPlaybackRate") ?? video?.playbackRate ?? null;

    const mediaVolumePercent = video ? video.volume * 100 : null;
    const playerVolumePercent = normalizePlayerVolumePercent(
      safeCall(player, "getVolume"),
      mediaVolumePercent
    );
    const exactCompensatedVolume =
      activeExactVolume && activeExactVolume.video === video
        ? activeExactVolume.targetPercent
        : null;
    const volumePercent =
      Number.isFinite(exactCompensatedVolume)
        ? exactCompensatedVolume
        : hasFractionalPercent(mediaVolumePercent)
        ? mediaVolumePercent
        : Number.isFinite(playerVolumePercent) && Number.isFinite(mediaVolumePercent)
          ? Math.min(playerVolumePercent, mediaVolumePercent)
          : playerVolumePercent ?? mediaVolumePercent ?? null;

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
    if (player && typeof player.setPlaybackRate === "function") {
      player.setPlaybackRate(speed);
    }

    const video = getVideo();
    if (video) video.playbackRate = speed;
  };

  const applyVolumePercent = async (volumePercent) => {
    const player = getPlayer();
    const video = getVideo();
    if (!video) return;

    const clampedPercent = Math.min(100, Math.max(0, volumePercent));
    const exactCompensationNeeded = requiresExactVolumeCompensation(clampedPercent);
    const basePercent = exactCompensationNeeded
      ? Math.min(100, Math.max(5, Math.ceil(clampedPercent / 5) * 5))
      : clampedPercent;
    const shouldUsePlayerVolumeApi = basePercent === 0 || basePercent >= 5;

    // YouTube's player API tends to snap tiny values up to 5, so for 1-4%
    // we treat the media element as the source of truth instead.
    if (shouldUsePlayerVolumeApi && player && typeof player.setVolume === "function") {
      player.setVolume(basePercent);
    }

    const v = Math.min(1, Math.max(0, basePercent / 100));
    video.volume = v;

    if (!exactCompensationNeeded) {
      clearExactVolumeCompensation();
      return;
    }

    const audioGraph = await ensureAudioGraph(video);
    if (!audioGraph) return;
    audioGraph.gainNode.gain.value = clampedPercent / basePercent;
    activeExactVolume = {
      video,
      targetPercent: clampedPercent,
      basePercent,
    };
  };

  const getVideoKeyFromUrl = () => {
    try {
      const u = new URL(location.href);
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/")[2];
        return id || null;
      }
      return u.searchParams.get("v");
    } catch {
      return null;
    }
  };

  const getVideoIdentity = () => {
    const player = getPlayer();
    const videoData = safeCall(player, "getVideoData");
    const playerVideoId =
      videoData && typeof videoData === "object" ? videoData.video_id : null;

    return playerVideoId || getVideoKeyFromUrl() || null;
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
      cancelReset();
      applySpeed(data.speed);
      window.postMessage(
        { source: SOURCE, type: "STATE_RESPONSE", requestId, state: getState() },
        "*",
      );
      return;
    }

    if (type === "SET_VOLUME") {
      cancelReset();
      queueUserVolume(data.volumePercent);
      applyVolumePercent(data.volumePercent);
      window.postMessage(
        { source: SOURCE, type: "STATE_RESPONSE", requestId, state: getState() },
        "*",
      );
      return;
    }
  });

  let lastSent = null;
  let lastVideoIdentity = getVideoIdentity();
  let pendingReset = null;
  let pendingUserVolume = null;

  const queueReset = () => {
    pendingUserVolume = null;
    clearExactVolumeCompensation();
    pendingReset = {
      remainingAttempts: 6,
      nextAttemptAt: Date.now(),
    };
  };

  const cancelReset = () => {
    pendingReset = null;
  };

  const queueUserVolume = (volumePercent) => {
    const target = Math.min(100, Math.max(0, volumePercent));
    const isFractionalTarget = hasFractionalPercent(target);
    pendingUserVolume = {
      target,
      isFractionalTarget,
      remainingAttempts: isFractionalTarget ? Infinity : 8,
      nextAttemptAt: Date.now(),
    };
  };

  const cancelUserVolume = () => {
    pendingUserVolume = null;
  };

  setInterval(() => {
    const currentVideoIdentity = getVideoIdentity();

    if (currentVideoIdentity && currentVideoIdentity !== lastVideoIdentity) {
      lastVideoIdentity = currentVideoIdentity;
      queueReset();
    }

    const now = Date.now();
    if (pendingReset && now >= pendingReset.nextAttemptAt) {
      applySpeed(DEFAULT_SPEED);
      applyVolumePercent(DEFAULT_VOLUME_PERCENT);
      pendingReset.remainingAttempts -= 1;
      pendingReset.nextAttemptAt = now + 400;
      if (pendingReset.remainingAttempts <= 0) {
        cancelReset();
      }
    }

    if (pendingUserVolume && now >= pendingUserVolume.nextAttemptAt) {
      const currentVolume = Number(getState()?.volumePercent);
      const shouldReapply =
        !Number.isFinite(currentVolume) ||
        Math.abs(currentVolume - pendingUserVolume.target) >= 0.35;

      if (shouldReapply) {
        applyVolumePercent(pendingUserVolume.target);
      }

      if (pendingUserVolume.isFractionalTarget) {
        pendingUserVolume.nextAttemptAt = now + 750;
      } else {
        pendingUserVolume.remainingAttempts -= 1;
        pendingUserVolume.nextAttemptAt = now + 250;
        if (pendingUserVolume.remainingAttempts <= 0) {
          cancelUserVolume();
        }
      }
    }

    const state = getState();
    if (!state) return;

    if (
      pendingReset &&
      state.playbackRate === DEFAULT_SPEED &&
      Math.round(Number(state.volumePercent)) === DEFAULT_VOLUME_PERCENT
    ) {
      cancelReset();
    }

    if (
      pendingUserVolume &&
      Math.abs(Number(state.volumePercent) - pendingUserVolume.target) < 0.6 &&
      !pendingUserVolume.isFractionalTarget
    ) {
      cancelUserVolume();
    }

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
