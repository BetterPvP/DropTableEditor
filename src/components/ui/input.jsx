import * as React from "react"
import { cn } from "../../lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-slate-700/60 bg-slate-900/40 backdrop-blur-sm px-3 py-2 text-sm text-slate-100",
        "placeholder:text-slate-500",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:border-cyan-500/70",
        "hover:border-slate-600/70 hover:bg-slate-900/60",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-all duration-200",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})

export { Input }
