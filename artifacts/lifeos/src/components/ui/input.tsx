import * as React from "react"

import { cn } from "@/lib/utils"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const fieldLabelClassName = "text-sm font-medium text-foreground"
const fieldBaseClassName =
  "flex h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-")

    return (
      <div className="min-w-0 space-y-1.5">
        {label ? (
          <label htmlFor={inputId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            fieldBaseClassName,
            error ? "border-destructive focus-visible:ring-destructive" : null,
            className
          )}
          {...props}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }
)
Input.displayName = "Input"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, options, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-")

    return (
      <div className="space-y-1.5">
        {label ? (
          <label htmlFor={selectId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            fieldBaseClassName,
            error ? "border-destructive focus-visible:ring-destructive" : null,
            className
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }
)
Select.displayName = "Select"

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  wrapperClassName?: string
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, wrapperClassName, label, error, id, ...props }, ref) => {
    const textAreaId = id || label?.toLowerCase().replace(/\s+/g, "-")

    return (
      <div className={cn("space-y-1.5", wrapperClassName)}>
        {label ? (
          <label htmlFor={textAreaId} className={fieldLabelClassName}>
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={textAreaId}
          className={cn(
            "flex min-h-[80px] w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none",
            error ? "border-destructive focus-visible:ring-destructive" : null,
            className
          )}
          {...props}
        />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    )
  }
)
TextArea.displayName = "TextArea"

export { Input, Select, TextArea }
