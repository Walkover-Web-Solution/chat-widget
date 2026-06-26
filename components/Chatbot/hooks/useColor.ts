import { getGradientBackground, isColorLight, withAlpha } from "@/utils/themeUtility";
import { useTheme } from "@mui/material";

export const useColor = () => {
    const theme = useTheme();
    const primaryColor = theme.palette.primary.main;
    const isLight = isColorLight(primaryColor);
    const textColor = isLight ? "black" : "white";

    return {
      primaryBgColor: primaryColor,
      // Kept separate from primaryBgColor so the text color can be customized independently in the future.
      primaryTextColor: primaryColor,
      foregroundColor: textColor,
      primaryGradientBg: getGradientBackground(primaryColor),
      primaryTintColor: withAlpha(primaryColor, 0.12),
      primaryHoverTintColor: withAlpha(primaryColor, 0.08),
      headerHoverBg: isLight
        ? "rgba(0, 0, 0, 0.08)"
        : "rgba(255, 255, 255, 0.18)",
    }
}