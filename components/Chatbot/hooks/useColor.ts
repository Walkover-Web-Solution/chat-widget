import { getPrimaryGradientBg, isColorLight, withAlpha } from "@/utils/themeUtility";
import { useTheme } from "@mui/material";

export const useColor = () => {
    const theme = useTheme();
    const backgroundColor = theme.palette.primary.main;
    const isLight = isColorLight(backgroundColor);
    const textColor = isLight ? "black" : "white";

    return {
      backgroundColor,
      textColor,
      primaryBgColor: backgroundColor,
      primaryTextColor: textColor,
      foregroundColor: textColor,
      primaryGradientBg: getPrimaryGradientBg(backgroundColor),
      // Soft translucent tint of the primary color — used for icon bubbles,
      // badges, and chip backgrounds so they follow the active theme.
      primaryTintColor: withAlpha(backgroundColor, 0.12),
      // Slightly stronger primary tint — useful for hover states on neutral
      // surfaces (cards, outlined buttons) so the hover reads as on-theme.
      primaryHoverTintColor: withAlpha(backgroundColor, 0.08),
      // Translucent overlay that reads well on any colored header
      // (light theme → near-white wash, dark theme → near-black wash).
      // Use as `hover:bg-{headerHoverBg}` for icon buttons in headers.
      headerHoverBg: isLight
        ? "rgba(0, 0, 0, 0.08)"
        : "rgba(255, 255, 255, 0.18)",
    }
}