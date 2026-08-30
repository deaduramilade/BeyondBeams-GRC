"use client";

import { useTransition } from "react";
import { LoaderCircle, RotateCw } from "lucide-react";
import { retryJobAction } from "@/app/actions/jobs";
import { Button } from "@/components/ui/button";

export function JobRetryButton({ jobId, disabled }: { jobId: string; disabled?: boolean }) {
  const [pending, start] = useTransition();

  function onRetry() {
    start(async () => {
      await retryJobAction(jobId);
    });
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled || pending}
      onClick={onRetry}
      className="h-7 px-2.5 text-[11px] gap-1"
    >
      {pending ? <LoaderCircle className="size-3 animate-spin" /> : <RotateCw className="size-3" />}
      Retry
    </Button>
  );
}
