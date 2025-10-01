"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";

const Avatar = AvatarPrimitive.Root;
const AvatarImage = AvatarPrimitive.Image;
const AvatarFallback = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>) => (
  <AvatarPrimitive.Fallback className={cn("flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-xs font-semibold", className)} {...props} />
);

export { Avatar, AvatarImage, AvatarFallback };
