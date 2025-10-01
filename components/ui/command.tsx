"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

const Command = React.forwardRef<React.ElementRef<typeof CommandPrimitive>, React.ComponentPropsWithoutRef<typeof CommandPrimitive>>(
  ({ className, ...props }, ref) => (
    <CommandPrimitive
      ref={ref}
      className={cn(
        "glass-panel flex h-full w-full flex-col overflow-hidden rounded-xl border border-white/10 text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Command.displayName = CommandPrimitive.displayName;

const CommandInput = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Input>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>(
  ({ className, ...props }, ref) => (
    <div className="flex items-center border-b border-white/5 px-4">
      <Search className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden />
      <CommandPrimitive.Input
        ref={ref}
        className={cn("flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground", className)}
        {...props}
      />
    </div>
  ),
);
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<React.ElementRef<typeof CommandPrimitive.List>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>>(
  ({ className, ...props }, ref) => (
    <CommandPrimitive.List ref={ref} className={cn("max-h-72 overflow-y-auto px-2 pb-2", className)} {...props} />
  ),
);
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = CommandPrimitive.Empty;
const CommandGroup = CommandPrimitive.Group;
const CommandItem = React.forwardRef<React.ElementRef<typeof CommandPrimitive.Item>, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>>(
  ({ className, ...props }, ref) => (
    <CommandPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg px-3 py-2 text-sm aria-selected:bg-primary/15 aria-selected:text-primary-foreground",
        className,
      )}
      {...props}
    />
  ),
);
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandSeparator = CommandPrimitive.Separator;

export { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem, CommandSeparator };
