import * as React from "react"
import { cn } from "../../lib/utils"

const Button = React.forwardRef(({ className, variant = "default", size = "default", ...props }, ref) => {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50 backdrop-blur-sm",
        {
          "bg-gradient-to-r from-cyan-500/80 to-blue-500/80 text-white hover:from-cyan-600/90 hover:to-blue-600/90 shadow-lg shadow-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/40 hover:-translate-y-0.5 border border-cyan-400/30":
            variant === "default",
          "bg-slate-800/60 text-slate-100 hover:bg-slate-700/70 border border-slate-700/50 hover:border-slate-600/60 backdrop-blur-md":
            variant === "secondary",
          "bg-gradient-to-r from-purple-500/80 to-pink-500/80 text-white hover:from-purple-600/90 hover:to-pink-600/90 shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 hover:-translate-y-0.5 border border-purple-400/30":
            variant === "accent",
          "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 backdrop-blur-sm":
            variant === "destructive",
          "hover:bg-slate-800/60 text-slate-300 border border-transparent hover:border-slate-700/50 backdrop-blur-sm":
            variant === "ghost",
          "h-11 px-6": size === "default",
          "h-9 px-4 text-xs": size === "sm",
          "h-12 px-8 text-base": size === "lg",
          "h-9 w-9 p-0": size === "icon",
        },
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

export { Button }
