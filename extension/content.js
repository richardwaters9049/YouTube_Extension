chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SET_SPEED") {
    function setSpeed() {
      const video = document.querySelector("video");
      if (video) {
        video.playbackRate = message.speed;
        console.log("Speed set to", message.speed);
      } else {
        // Try again after a short delay
        setTimeout(setSpeed, 200);
      }
    }
    setSpeed();
  }
});

