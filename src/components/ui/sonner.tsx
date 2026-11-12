"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-[12px] group-[.toaster]:border-[#E2E8F0] group-[.toaster]:bg-white group-[.toaster]:text-[#0F172A] group-[.toaster]:shadow-md",
          description: "group-[.toast]:text-[#64748B]",
          actionButton:
            "group-[.toast]:bg-[#D93829] group-[.toast]:text-white",
          cancelButton:
            "group-[.toast]:bg-[#F1F5F9] group-[.toast]:text-[#334155]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
