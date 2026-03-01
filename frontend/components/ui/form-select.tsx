import { forwardRef, type SelectHTMLAttributes } from "react";

interface FormSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  selectSize?: "default" | "sm";
  fullWidth?: boolean;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ selectSize = "default", fullWidth = false, className = "", ...props }, ref) => {
    const sizeClasses = selectSize === "sm" ? "px-2 py-1" : "px-3 py-1";
    const widthClass = fullWidth ? "w-full" : "";

    return (
      <select
        ref={ref}
        className={`${sizeClasses} ${widthClass} border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${className}`}
        {...props}
      />
    );
  }
);

FormSelect.displayName = "FormSelect";
