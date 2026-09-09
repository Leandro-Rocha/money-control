"use client";

import React, { useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrencyInput } from "@/lib/format";
import { cn } from "@/lib/utils";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange"> {
  value: string;
  onChangeValue: (value: string) => void;
  allowNegative?: boolean;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  (
    {
      value,
      onChangeValue,
      allowNegative = false,
      className,
      onFocus,
      placeholder = "0,00",
      ...props
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    useIsomorphicLayoutEffect(() => {
      if (inputRef.current && document.activeElement === inputRef.current) {
        if (inputRef.current.selectionStart === inputRef.current.selectionEnd) {
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatCurrencyInput(e.target.value, allowNegative);
      onChangeValue(formatted);
    };

    return (
      <Input
        {...props}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={(e) => {
          if (value) {
            e.target.select();
          }
          onFocus?.(e);
        }}
        className={cn("text-right font-mono tabular-nums", className)}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";
