import { ComponentType } from "react";
import { ThemeProps } from "@/types/theme";
import DefaultOriginalLayout from "./default-original/layout";
import NeoBrutalismLayout from "./neo-brutalism/layout";

export const themes: Record<string, ComponentType<ThemeProps>> = {
  "default-original": DefaultOriginalLayout,
  "neo-brutalism": NeoBrutalismLayout,
};

export const DEFAULT_THEME = "default-original";
