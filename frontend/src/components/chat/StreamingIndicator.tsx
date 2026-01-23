import { cn } from "@/lib/utils";
import { testId } from "@/lib/test-id";

interface StreamingIndicatorProps {
  className?: string;
}

export function StreamingIndicator({ className }: StreamingIndicatorProps) {
  return (
    <span
      {...testId("streaming-indicator")}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      <span className="size-1.5 animate-pulse rounded-full bg-current opacity-75" />
      <span
        className="size-1.5 animate-pulse rounded-full bg-current opacity-75"
        style={{ animationDelay: "150ms" }}
      />
      <span
        className="size-1.5 animate-pulse rounded-full bg-current opacity-75"
        style={{ animationDelay: "300ms" }}
      />
    </span>
  );
}
