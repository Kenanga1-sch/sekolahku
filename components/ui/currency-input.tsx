import * as React from "react";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value?: number;
  onChange: (value: number | undefined) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onChange, placeholder = "0", ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Update display value when external value changes
    React.useEffect(() => {
        if (value === undefined || value === null) {
            setDisplayValue("");
        } else {
            // Only update display if it doesn't match the current parsed value to avoid cursor jumping
            // Actually, for simple implementation, always formatting on blur or effect is safer
            setDisplayValue(new Intl.NumberFormat("id-ID").format(value));
        }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;
      
      // Remove non-digit characters
      const numericString = inputValue.replace(/\D/g, "");

      if (numericString === "") {
        onChange(undefined);
        setDisplayValue("");
        return;
      }

      const numericValue = parseInt(numericString, 10);
      onChange(numericValue);
      
      // Update display immediately for "Auto Format" sensation
      // Note: This might cause cursor jump issues if editing in the middle, 
      // but for "Currency Input" usually users type at the end.
      setDisplayValue(new Intl.NumberFormat("id-ID").format(numericValue));
    };

    return (
      <Input
        ref={ref}
        type="text" // Use text to allow formatting
        inputMode="numeric" // Mobile keyboard numeric
        value={displayValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={className}
        {...props}
      />
    );
  }
);
CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
