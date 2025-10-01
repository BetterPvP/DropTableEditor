"use client";

import { Badge } from "@/components/ui/badge";

export function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  switch (status) {
    case "saving":
      return <Badge variant="outline">Saving...</Badge>;
    case "saved":
      return <Badge variant="success">Saved</Badge>;
    case "error":
      return <Badge variant="destructive">Save failed</Badge>;
    default:
      return <Badge variant="outline">Idle</Badge>;
  }
}
