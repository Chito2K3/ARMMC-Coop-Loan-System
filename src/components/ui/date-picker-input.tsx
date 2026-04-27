"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface DatePickerInputProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function DatePickerInput({
  value,
  onChange,
  disabled,
  className,
  placeholder = "MM/DD/YYYY",
}: DatePickerInputProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState<string>("");

  // Sync internal text state with external Date prop when it changes
  React.useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, "MM/dd/yyyy"));
    } else {
      setInputValue("");
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // Only attempt to parse if it's the right length for MM/DD/YYYY to avoid thrashing
    if (val.length === 10) {
      const parsedDate = parse(val, "MM/dd/yyyy", new Date());
      if (isValid(parsedDate)) {
        onChange?.(parsedDate);
      }
    } else if (val === "") {
        onChange?.(undefined);
    }
  };

  const handleInputBlur = () => {
    // If they blur and it's invalid, reset to the current actual value
    if (inputValue !== "") {
      const parsedDate = parse(inputValue, "MM/dd/yyyy", new Date());
      if (!isValid(parsedDate)) {
        if (value && isValid(value)) {
          setInputValue(format(value, "MM/dd/yyyy"));
        } else {
          setInputValue("");
          onChange?.(undefined);
        }
      } else {
        onChange?.(parsedDate);
      }
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      setInputValue(format(date, "MM/dd/yyyy"));
      onChange?.(date);
      setIsOpen(false);
    } else {
      setInputValue("");
      onChange?.(undefined);
    }
  };

  return (
    <div className={cn("relative flex items-center w-full", className)}>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10" // Make room for the calendar icon
        maxLength={10}
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
            disabled={disabled}
            type="button"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleCalendarSelect}
            initialFocus
            defaultMonth={value || new Date()}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
