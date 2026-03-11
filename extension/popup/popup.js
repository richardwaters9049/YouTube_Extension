document.addEventListener("DOMContentLoaded", () => {
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

  const clamp = (v) => Math.min(4, Math.max(0.25, v));
  const clampVolumePercent = (v) => Math.min(100, Math.max(0, v));

  const updateUI = (speed, { syncManual = true } = {}) => {
    speedValue.textContent = `${speed.toFixed(2)}×`;
    slider.value = String(speed);
    if (manualSpeed && syncManual) manualSpeed.value = String(speed);

    // subtle animation
    speedValue.style.transform = "scale(1.08)";
    setTimeout(() => {
      speedValue.style.transform = "scale(1)";
    }, 120);
  };

  const applySpeed = (speed) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) return;

      chrome.scripting.executeScript({
        target: { tabId },
        func: (s) => {
          const video = document.querySelector("video");
          if (video) video.playbackRate = s;
        },
        args: [speed],
      });
    });
  };

  const applyVolume = (volumePercent) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tabId = tabs?.[0]?.id;
      if (!tabId) return;

      const volume = volumePercent / 100;

      chrome.scripting.executeScript({
        target: { tabId },
        func: (v) => {
          const video = document.querySelector("video");
          if (video) video.volume = v;
        },
        args: [volume],
      });
    });
  };

  /* ───────── Reset on open ───────── */

  updateUI(1);
  if (volumeValue && volumeSlider) {
    volumeValue.textContent = "100%";
    volumeSlider.value = "100";
    if (manualVolume) manualVolume.value = "100";
  }

  /* ───────── Slider behavior ───────── */

  slider.addEventListener("input", () => {
    pendingSpeed = Number(slider.value);
    speedValue.textContent = `${pendingSpeed.toFixed(2)}×`;
    if (manualSpeed) manualSpeed.value = String(pendingSpeed);
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
    const rawText = manualSpeed?.value?.trim();
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
  manualSpeed?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyManualSpeed();
  });

  resetSpeed?.addEventListener("click", () => {
    pendingSpeed = 1;
    updateUI(1, { syncManual: true });
    applySpeed(1);
  });

  /* ───────── Volume slider + input ───────── */

  const updateVolumeUI = (percent, { syncManual = true } = {}) => {
    if (!volumeValue || !volumeSlider) return;
    volumeValue.textContent = `${percent}%`;
    volumeSlider.value = String(percent);
    if (manualVolume && syncManual) manualVolume.value = String(percent);
  };

  volumeSlider?.addEventListener("input", () => {
    pendingVolumePercent = Number(volumeSlider.value);
    if (volumeValue) volumeValue.textContent = `${pendingVolumePercent}%`;
    if (manualVolume) manualVolume.value = String(pendingVolumePercent);
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
    const rawText = manualVolume?.value?.trim();
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
    applyVolume(percent);
  };

  applyVolumeBtn?.addEventListener("click", applyManualVolume);
  manualVolume?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyManualVolume();
  });

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

    if (e.key === "1") speed = 0.5;
    if (e.key === "2") speed = 1;
    if (e.key === "3") speed = 1.5;
    if (e.key === "4") speed = 2;

    speed = clamp(speed);

    pendingSpeed = speed;
    updateUI(speed);
    applySpeed(speed);
  });
});
