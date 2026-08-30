"use client";

import { useTransition, useState } from "react";
import { Camera, CheckCircle2, LoaderCircle } from "lucide-react";
import { triggerAnalyticsSnapshotAction } from "@/app/actions/analytics";
import { Button } from "@/components/ui/button";

export function SnapshotTrigger({ lastSnapshotAt }: { lastSnapshotAt?: string | null }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  function onCapture() {
    start(async () => {
      setMessage("");
      const result = await triggerAnalyticsSnapshotAction("DAILY");
      if (result.success) {
        setMessage("Snapshot captured successfully.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {lastSnapshotAt && (
        <span className="text-xs text-muted-foreground">
          Latest snapshot: {new Date(lastSnapshotAt).toLocaleDateString("en-US", { dateStyle: "medium", timeStyle: "short" })}
        </span>
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={onCapture}
        className="h-8 text-xs gap-1.5"
      >
        {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Camera className="size-3.5 text-primary" />}
        Capture point-in-time snapshot
      </Button>
      {message && (
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <CheckCircle2 className="size-3.5" />
          {message}
        </span>
      )}
    </div>
  );
}
