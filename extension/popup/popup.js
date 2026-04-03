document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("is-open");
  const handleCloseAnimation = () => {
    document.body.classList.remove("is-open");
    document.body.classList.add("is-closing");
  };

  window.addEventListener("pagehide", handleCloseAnimation);
  window.addEventListener("blur", handleCloseAnimation);

  const slider = document.getElementById("slider");
  const speedValue = document.getElementById("speedValue");
  const presetButtons = document.querySelectorAll(".presets button");
  const manualSpeed = document.getElementById("manualSpeed");
  const applyManual = document.getElementById("applyManual");
  const resetSpeed = document.getElementById("resetSpeed");
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeValue = document.getElementById("volumeValue");
  const manualVolume = document.getElementById("manualVolume");
  const applyVolumeBtn = document.getElementById("applyVolume");

  if (!slider || !speedValue) {
    console.error("YouTube Speed: popup DOM not ready");
    return;
  }

  let pendingSpeed = 1;
  let pendingVolumePercent = 100;
  let lastKnownRate = null;
  let lastKnownVolumePercent = null;
  let suppressSyncUntil = 0;
  let draftManualVolume = "";
  let draftManualSpeed = "1";

  const clamp = (v) => Math.min(4, Math.max(0.25, v));
  const clampVolumePercent = (v) => Math.min(100, Math.max(0, v));
  const formatVolumePercent = (value) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1);
  const suppressSync = (ms = 1500) => {
    suppressSyncUntil = Date.now() + ms;
  };

  const updateUI = (speed) => {
    speedValue.textContent = `${speed.toFixed(2)}×`;
    slider.value = String(speed);
    draftManualSpeed = String(speed);
    if (manualSpeed) manualSpeed.value = draftManualSpeed;

    // subtle animation
    speedValue.style.transform = "scale(1.08)";
    setTimeout(() => {
      speedValue.style.transform = "scale(1)";
    }, 120);
  };

  const getActiveTab = () =>
    new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs?.[0] ?? null);
      });
    });

  const execOnTab = (tabId, func, args = []) =>
    new Promise((resolve) => {
      chrome.scripting.executeScript(
        { target: { tabId }, func, args },
        (results) => {
          const err = chrome.runtime.lastError;
          if (err) return resolve(null);
          resolve(results?.[0]?.result ?? null);
        }
      );
    });

  const isSupportedTab = (tab) => Boolean(tab?.url?.includes("youtube.com"));

  const getState = () =>
    new Promise((resolve) => {
      getActiveTab().then((tab) => {
        const tabId = tab?.id;
        if (!tabId) return resolve(null);
        if (!isSupportedTab(tab)) return resolve(null);

        chrome.tabs.sendMessage(tabId, { type: "GET_STATE" }, (resp) => {
          const err = chrome.runtime.lastError;
          if (!err) return resolve(resp ?? null);

          chrome.runtime.sendMessage(
            { type: "GET_LAST_STATE", tabId },
            (cached) => {
              // Must read lastError to avoid "Unchecked runtime.lastError" noise.
              const cachedErr = chrome.runtime.lastError;
              if (!cachedErr && cached != null) return resolve(cached);

              execOnTab(
                tabId,
                () => {
                  const video =
                    document.querySelector("video.html5-main-video") ||
                    document.querySelector("video");
                  if (!video) return null;
                  return {
                    playbackRate: video.playbackRate,
                    volumePercent: video.volume * 100,
                    muted: video.muted,
                    url: location.href,
                  };
                },
                []
              ).then(resolve);
            }
          );
        });
      });
    });

  const applySpeed = (speed) => {
    getActiveTab().then((tab) => {
      const tabId = tab?.id;
      if (!tabId) return;
      if (!isSupportedTab(tab)) return;

      chrome.tabs.sendMessage(tabId, { type: "SET_SPEED", speed }, () => {
        const err = chrome.runtime.lastError;
        if (!err) return;

        void execOnTab(
          tabId,
          (s) => {
            const video =
              document.querySelector("video.html5-main-video") ||
              document.querySelector("video");
            if (video) video.playbackRate = s;
          },
          [speed]
        );
      });
    });
  };

  const applyVolume = (volumePercent) => {
    getActiveTab().then((tab) => {
      const tabId = tab?.id;
      if (!tabId) return;
      if (!isSupportedTab(tab)) return;

      chrome.tabs.sendMessage(
        tabId,
        { type: "SET_VOLUME", volumePercent },
        () => {
          const err = chrome.runtime.lastError;
          if (!err) return;

          void execOnTab(
            tabId,
            (p) => {
              const video =
                document.querySelector("video.html5-main-video") ||
                document.querySelector("video");
              if (!video) return;
              const v = Math.min(1, Math.max(0, p / 100));
              video.volume = v;
            },
            [volumePercent]
          );
        }
      );
    });
  };

  /* ───────── Reset on open ───────── */

  updateUI(1);
  if (volumeValue && volumeSlider) {
    volumeValue.textContent = "100%";
    volumeSlider.value = "100";
    if (manualVolume) manualVolume.value = "";
  }

  /* ───────── Slider behavior ───────── */

  slider.addEventListener("input", () => {
    suppressSync();
    pendingSpeed = Number(slider.value);
    speedValue.textContent = `${pendingSpeed.toFixed(2)}×`;
  });

  const applyOnRelease = () => {
    pendingSpeed = clamp(pendingSpeed);
    updateUI(pendingSpeed);
    applySpeed(pendingSpeed);
  };

  slider.addEventListener("mouseup", applyOnRelease);
  slider.addEventListener("touchend", applyOnRelease);
  slider.addEventListener("pointerup", applyOnRelease);

  /* ───────── Preset buttons ───────── */

  presetButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const speed = clamp(Number(btn.dataset.speed));
      pendingSpeed = speed;
      updateUI(speed);
      applySpeed(speed);
    });
  });

  /* ───────── Manual input ───────── */

  const applyManualSpeed = () => {
    suppressSync();
    const rawText = draftManualSpeed.trim();
    if (!rawText) return;

    const normalized = rawText.replace(",", ".");
    const speed = Number.parseFloat(normalized);
    if (!Number.isFinite(speed)) return;

    pendingSpeed = speed;
    speedValue.textContent = `${rawText}×`;
    if (speed >= 0.25 && speed <= 4) slider.value = String(speed);
    applySpeed(speed);
  };

  applyManual?.addEventListener("click", applyManualSpeed);
  applyManual?.addEventListener("mousedown", () => suppressSync());
  applyManual?.addEventListener("pointerdown", () => suppressSync());
  manualSpeed?.addEventListener("focus", () => suppressSync(3000));
  manualSpeed?.addEventListener("input", () => {
    draftManualSpeed = manualSpeed.value;
    suppressSync(3000);
  });
  manualSpeed?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyManualSpeed();
  });

  resetSpeed?.addEventListener("click", () => {
    pendingSpeed = 1;
    updateUI(1);
    applySpeed(1);
  });

  /* ───────── Volume slider + input ───────── */

  const updateVolumeUI = (percent) => {
    if (!volumeValue || !volumeSlider) return;
    volumeValue.textContent = `${formatVolumePercent(percent)}%`;
    volumeSlider.value = String(percent);
  };

  volumeSlider?.addEventListener("input", () => {
    suppressSync();
    pendingVolumePercent = Number(volumeSlider.value);
    if (volumeValue) {
      volumeValue.textContent = `${formatVolumePercent(pendingVolumePercent)}%`;
    }
  });

  const applyVolumeOnRelease = () => {
    pendingVolumePercent = clampVolumePercent(pendingVolumePercent);
    updateVolumeUI(pendingVolumePercent);
    applyVolume(pendingVolumePercent);
  };

  volumeSlider?.addEventListener("mouseup", applyVolumeOnRelease);
  volumeSlider?.addEventListener("touchend", applyVolumeOnRelease);
  volumeSlider?.addEventListener("pointerup", applyVolumeOnRelease);

  const applyManualVolume = () => {
    suppressSync();
    const rawText = draftManualVolume.trim();
    if (!rawText) return;

    const normalized = rawText.replace("%", "").trim().replace(",", ".");
    const percent = Number.parseFloat(normalized);
    if (!Number.isFinite(percent)) return;

    pendingVolumePercent = percent;
    if (volumeValue) {
      volumeValue.textContent = `${rawText}${rawText.includes("%") ? "" : "%"}`;
    }
    if (percent >= 0 && percent <= 100 && volumeSlider) {
      volumeSlider.value = String(percent);
    }
    draftManualVolume = rawText;
    if (manualVolume) manualVolume.value = rawText;
    applyVolume(percent);
  };

  applyVolumeBtn?.addEventListener("click", applyManualVolume);
  applyVolumeBtn?.addEventListener("mousedown", () => suppressSync());
  applyVolumeBtn?.addEventListener("pointerdown", () => suppressSync());
  manualVolume?.addEventListener("focus", () => suppressSync(3000));
  manualVolume?.addEventListener("input", () => {
    draftManualVolume = manualVolume.value;
    suppressSync(3000);
  });
  manualVolume?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyManualVolume();
  });

  /* ───────── Sync from page state ───────── */

  const isUserInteracting = () => {
    const target = document.activeElement;
    return (
      (target instanceof HTMLInputElement &&
        !["button", "checkbox", "radio"].includes(target.type)) ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  };

  const syncFromState = async () => {
    if (Date.now() < suppressSyncUntil) return;
    if (isUserInteracting()) return;

    const state = await getState();
    if (!state) return;

    const rate = Number(state.playbackRate);
    if (Number.isFinite(rate) && rate !== lastKnownRate) {
      lastKnownRate = rate;
      speedValue.textContent = `${rate.toFixed(2)}×`;
      slider.value = String(rate);
    }

    const vol = Number(state.volumePercent);
    if (Number.isFinite(vol)) {
      const roundedHalf = Math.round(vol * 2) / 2;
      if (roundedHalf !== lastKnownVolumePercent) {
        lastKnownVolumePercent = roundedHalf;
        updateVolumeUI(roundedHalf);
      }
    }
  };

  void syncFromState();
  const syncInterval = setInterval(syncFromState, 750);
  window.addEventListener("beforeunload", () => clearInterval(syncInterval));

  /* ───────── Keyboard shortcuts ───────── */

  window.addEventListener("keydown", (e) => {
    const target = e.target;
    const isTypingContext =
      (target instanceof HTMLInputElement &&
        !["button", "checkbox", "radio", "range"].includes(target.type)) ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable);

    if (isTypingContext) return;

    let speed = Number(slider.value);

    if (e.key === "ArrowRight") speed += 0.05;
    if (e.key === "ArrowLeft") speed -= 0.05;

    speed = clamp(speed);

    pendingSpeed = speed;
    updateUI(speed);
    applySpeed(speed);
  });
});
