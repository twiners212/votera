import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: "default" | "lg";
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, type, inputSize = "default", leftIcon, rightElement, ...props },
    ref
  ) => {
    const sizeClasses = inputSize === "lg" ? "h-12 text-base" : "h-10 text-sm";

    const inputElement = (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-[10px] border border-[#CBD5E1] bg-white px-3.5 py-2 text-[#0F172A] shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[#94A3B8] focus-visible:border-[#D93829] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/20 disabled:cursor-not-allowed disabled:bg-[#F8FAFC] disabled:opacity-60",
          sizeClasses,
          leftIcon ? "pl-10" : "",
          rightElement ? "pr-10" : "",
          className
        )}
        ref={ref}
        {...props}
      />
    );

    if (!leftIcon && !rightElement) {
      return inputElement;
    }

    return (
      <div className="relative flex w-full items-center">
        {leftIcon ? (
          <span className="pointer-events-none absolute left-3.5 flex items-center text-[#94A3B8]">
            {leftIcon}
          </span>
        ) : null}
        {inputElement}
        {rightElement ? (
          <span className="absolute right-3 flex items-center">
            {rightElement}
          </span>
        ) : null}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
