import { getPrimaryGradientBg, isColorLight } from "@/utils/themeUtility";
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
    }
}