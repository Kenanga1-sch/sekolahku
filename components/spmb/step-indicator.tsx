"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  title: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

export default function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="relative">
      {/* Progress Bar Container */}
      <div className="absolute top-5 left-0 w-full h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
        {/* Animated Progress Bar */}
        <div 
          className="h-full bg-primary transition-all duration-500 ease-in-out"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />
      </div>

      {/* Steps Row */}
      <div className="relative flex justify-between">
        {steps.map((step) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;

          return (
            <div key={step.id} className="flex flex-col items-center group">
              {/* Step Circle */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-300 z-10",
                  isCompleted
                    ? "bg-primary border-primary text-primary-foreground scale-100"
                    : isCurrent
                    ? "bg-background border-primary text-primary scale-110 shadow-lg shadow-primary/20"
                    : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-bold">{step.id}</span>
                )}
              </div>

              {/* Step Labels */}
              <div className="mt-4 text-center hidden sm:block">
                <p
                  className={cn(
                    "text-sm font-medium transition-colors duration-300",
                    isCurrent || isCompleted ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-[10px] text-muted-foreground max-w-[80px] leading-tight mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
