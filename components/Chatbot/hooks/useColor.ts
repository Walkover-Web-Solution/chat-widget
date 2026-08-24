import { getGradientBackground, isColorLight, withAlpha } from "@/utils/themeUtility";
import { useTheme } from "@mui/material";

export const useColor = () => {
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;
  const mode = theme.palette.mode;
  const isLight = isColorLight(primaryColor);
  const foregroundColor = mode === "dark" ? "white" : isLight ? "black" : "white";
  return {
    primaryBgColor: primaryColor,
    // Kept separate from primaryBgColor so the text color can be customized independently in the future.
    primaryTextColor: primaryColor,
    foregroundColor: foregroundColor,
    primaryGradientBg: getGradientBackground(primaryColor, mode),
    primaryTintColor: withAlpha(primaryColor, mode === "dark" ? 0.18 : 0.12),
    primaryHoverTintColor: withAlpha(primaryColor, mode === "dark" ? 0.12 : 0.08),
    headerHoverBg: mode === "dark"
      ? "rgba(255, 255, 255, 0.12)"
      : isLight
        ? "rgba(0, 0, 0, 0.08)"
        : "rgba(255, 255, 255, 0.18)",
  }
}