import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { darkColors, lightColors } from "./theme";

export type AppearanceChoice = "system" | "light" | "dark";
const key = "backinit-native-appearance-v1";
const ThemeContext = createContext({
  colors: darkColors,
  dark: true,
  choice: "system" as AppearanceChoice,
  setChoice: (_choice: AppearanceChoice) => {},
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [choice, update] = useState<AppearanceChoice>("system");
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(key)
      .then((value) => {
        if (
          active &&
          (value === "light" || value === "dark" || value === "system")
        )
          update(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const dark = choice === "dark" || (choice === "system" && system !== "light");
  const value = useMemo(
    () => ({
      colors: dark ? darkColors : lightColors,
      dark,
      choice,
      setChoice: (next: AppearanceChoice) => {
        update(next);
        void AsyncStorage.setItem(key, next).catch(() => undefined);
      },
    }),
    [dark, choice],
  );
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
