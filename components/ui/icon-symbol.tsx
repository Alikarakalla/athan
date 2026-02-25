import { MaterialIcons } from "@expo/vector-icons";
import { SymbolView, type SFSymbol } from "expo-symbols";
import type { StyleProp, ViewStyle } from "react-native";

type MaterialName = React.ComponentProps<typeof MaterialIcons>["name"];

type IconSymbolProps = {
  name: SFSymbol;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  fallbackName?: MaterialName;
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  fallbackName = "help-outline",
}: IconSymbolProps) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      style={style}
      fallback={<MaterialIcons name={fallbackName} size={size} color={color} />}
    />
  );
}

