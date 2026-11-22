import { Modal, Platform, ScrollView, Text, View } from "react-native";
import * as Application from "expo-application";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Brand, FocusButton } from "./components";
import { useTheme, type AppearanceChoice } from "./appearance";

export function Settings({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, choice, setChoice } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.canvasDeep }}
        contentContainerStyle={{
          padding: Platform.isTV ? 40 : 24,
          paddingTop: (Platform.isTV ? 40 : 24) + insets.top,
          paddingBottom: (Platform.isTV ? 40 : 24) + insets.bottom,
          gap: 24,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Brand compact />
          <FocusButton icon="close" onPress={onClose}>
            Close
          </FocusButton>
        </View>
        <Text
          accessibilityRole="header"
          style={{ color: colors.ink, fontSize: 30, fontWeight: "900" }}
        >
          Settings
        </Text>
        <View
          style={{
            backgroundColor: colors.panel,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: colors.line,
            padding: 24,
            gap: 16,
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "800" }}>
            Appearance
          </Text>
          <Text style={{ color: colors.muted, fontSize: 15 }}>
            Choose your look. Your preference is saved on this device.
          </Text>
          <View
            style={{ flexDirection: Platform.isTV ? "row" : "column", gap: 12 }}
          >
            {(
              [
                ["system", "System", "phone-portrait-outline"],
                ["light", "Light", "sunny-outline"],
                ["dark", "Dark", "moon-outline"],
              ] as const
            ).map(([value, label, icon]) => (
              <FocusButton
                key={value}
                icon={icon}
                selected={choice === value}
                accessibilityRole="radio"
                accessibilityState={{ checked: choice === value }}
                onPress={() => setChoice(value as AppearanceChoice)}
              >
                {label}
              </FocusButton>
            ))}
          </View>
        </View>
        <Text style={{ color: colors.muted }}>
          backinit · {Application.nativeApplicationVersion || "Development"}
        </Text>
      </ScrollView>
    </Modal>
  );
}
