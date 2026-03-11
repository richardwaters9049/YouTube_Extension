document.addEventListener("DOMContentLoaded", () => {
  const slider = document.getElementById("slider");
  const speedValue = document.getElementById("speedValue");
  const presetButtons = document.querySelectorAll(".presets button");
  const manualSpeed = document.getElementById("manualSpeed");
  const applyManual = document.getElementById("applyManual");
  const resetSpeed = document.getElementById("resetSpeed");

  if (!slider || !speedValue) {
    console.error("YouTube Speed: popup DOM not ready");
    return;
  }

  let pendingSpeed = 1;

  const clamp = (v) => Math.min(4, Math.max(0.25, v));

  const updateUI = (speed) => {
    speedValue.textContent = `${speed.toFixed(2)}×`;
    slider.value = String(speed);
    if (manualSpeed) manualSpeed.value = String(speed);

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

  /* ───────── Reset on open ───────── */

  updateUI(1);

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
    const raw = Number(manualSpeed?.value);
    if (!Number.isFinite(raw)) return;

    const speed = clamp(raw);
    pendingSpeed = speed;
    updateUI(speed);
    applySpeed(speed);
  };

  applyManual?.addEventListener("click", applyManualSpeed);
  manualSpeed?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyManualSpeed();
  });

  resetSpeed?.addEventListener("click", () => {
    pendingSpeed = 1;
    updateUI(1);
    applySpeed(1);
  });

  /* ───────── Keyboard shortcuts ───────── */

  window.addEventListener("keydown", (e) => {
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
