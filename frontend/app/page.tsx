"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";

export default function Page() {
  const [speed, setSpeed] = useState(1);

  const applySpeed = () => {
    // Send message out of the sandbox to popup/index.html
    window.parent.postMessage(
      {
        type: "SET_SPEED",
        speed,
      },
      "*"
    );
  };

  return (
    <main className="w-64 p-4 space-y-4">
      <h1 className="text-sm font-semibold">YouTube Speed</h1>

      <div className="space-y-2">
        <Slider
          value={[speed]}
          min={0.25}
          max={4}
          step={0.25}
          onValueChange={(v) => setSpeed(v[0])}
        />
        <p className="text-xs text-muted-foreground">
          {speed.toFixed(2)}×
        </p>
      </div>

      <Button onClick={applySpeed} className="w-full">
        Apply
      </Button>
    </main>
  );
}

