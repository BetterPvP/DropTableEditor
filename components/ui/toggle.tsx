"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Toggle = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean }>(
  ({ className, pressed = false, ...props }, ref) => (
    <button
      ref={ref}
      data-pressed={pressed ? "on" : "off"}
      className={cn(
        "inline-flex h-9 items-center rounded-md border border-white/10 px-3 text-sm font-medium transition-colors data-[pressed=on]:bg-primary/30 data-[pressed=on]:text-primary-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Toggle.displayName = "Toggle";

export { Toggle };
