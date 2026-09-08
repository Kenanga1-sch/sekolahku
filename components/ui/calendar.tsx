"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { id as localeId } from "react-day-picker/locale";

export type CalendarProps = React.ComponentProps<typeof DayPicker> & {
  components?: React.ComponentProps<typeof DayPicker>["components"];
};

function Calendar({
  className,
  components,
  showOutsideDays = false,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={localeId}
      className={cn("holiday-calendar p-3", className)}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          ),
        ...components,
      }}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}

export { Calendar, DayPicker };
