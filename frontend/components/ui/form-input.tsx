import { forwardRef, type InputHTMLAttributes } from "react";

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: "default" | "sm";
  fullWidth?: boolean;
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ inputSize = "default", fullWidth = false, className = "", ...props }, ref) => {
    const sizeClasses = inputSize === "sm" ? "px-2 py-1" : "px-3 py-1";
    const widthClass = fullWidth ? "w-full" : "";

    return (
      <input
        ref={ref}
        className={`${sizeClasses} ${widthClass} border rounded text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${className}`}
        {...props}
      />
    );
  }
);

FormInput.displayName = "FormInput";
