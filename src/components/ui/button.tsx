import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D93829]/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-[#D93829] text-white shadow-sm hover:bg-[#B8281B] rounded-[10px]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 rounded-[10px]",
        softDanger:
          "bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FECACA] rounded-[8px]",
        outline:
          "border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC] rounded-[10px]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-[10px]",
        ghost:
          "text-[#0F172A] hover:bg-[#F1F5F9] rounded-[10px]",
        link: "text-[#D93829] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[8px] px-3 text-xs",
        lg: "h-12 rounded-[10px] px-6 text-[15px]",
        icon: "h-10 w-10",
      },
    },
    compoundVariants: [
      {
        variant: "softDanger",
        size: "default",
        class: "h-8 px-3 text-xs rounded-[8px]",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
