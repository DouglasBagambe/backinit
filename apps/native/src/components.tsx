import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useState } from "react";
import {
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { WebView } from "react-native-webview";
import { colors, radii } from "./theme";
import type { Broadcast, Source, Video } from "./types";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand} accessibilityLabel="BackInIt">
      <View style={[styles.brandBall, compact && { width: 30, height: 30 }]}>
        <Ionicons name="football-outline" size={compact ? 20 : 27} color={colors.mint} />
      </View>
      <Text style={[styles.brandText, compact && { fontSize: 21 }]}>back<Text style={styles.brandAccent}>in</Text>it<Text style={styles.brandAccent}>.</Text></Text>
    </View>
  );
}

export function FocusButton({
  children,
  icon,
  selected,
  style,
  ...props
}: PressableProps & {
  children: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
  selected?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={({ pressed }) => [
        styles.focusButton,
        selected && styles.focusButtonSelected,
        focused && styles.focusButtonFocused,
        pressed && styles.pressed,
        style as object,
      ]}
    >
      {icon && <Ionicons name={icon} size={Platform.isTV ? 23 : 20} color={selected || focused ? colors.canvasDeep : colors.ink} />}
      <Text style={[styles.focusButtonText, (selected || focused) && styles.focusButtonTextActive]}>{children}</Text>
    </Pressable>
  );
}

export const BroadcastCard = memo(function BroadcastCard({
  item,
  saved,
  onPlay,
  onSave,
  large = false,
}: {
  item: Broadcast;
  saved: boolean;
  onPlay: (item: Broadcast) => void;
  onSave: (id: string) => void;
  large?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const width = Platform.isTV ? (large ? 440 : 330) : large ? 330 : 244;
  return (
    <Pressable
      onPress={() => onPlay(item)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={`Watch ${item.title}`}
      style={[styles.card, { width }, focused && styles.cardFocused]}
    >
      <ImageBackground
        source={item.poster ? { uri: item.poster } : undefined}
        style={[styles.cardArtwork, { height: Platform.isTV ? 182 : 138 }]}
        imageStyle={styles.cardImage}
      >
        {!item.poster && <Ionicons name="radio-outline" size={46} color={colors.mint} />}
        <LinearGradient colors={["transparent", "rgba(1,17,13,.88)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>{item.channel ? "LIVE 24/7" : "LIVE"}</Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onSave(item.id);
          }}
          style={styles.saveButton}
          accessibilityLabel={saved ? "Remove from saved" : "Save channel"}
        >
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={21} color={saved ? colors.lime : colors.ink} />
        </Pressable>
      </ImageBackground>
      <View style={styles.cardCopy}>
        <Text style={styles.cardMeta} numberOfLines={1}>{item.category} · {item.competition}</Text>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.cardSources}>{item.sources.length} stream{item.sources.length === 1 ? "" : "s"}</Text>
      </View>
    </Pressable>
  );
});

export const ReplayCard = memo(function ReplayCard({ item, onPlay }: { item: Video; onPlay: (item: Video) => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={() => onPlay(item)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.replayCard, focused && styles.cardFocused]}
      accessibilityLabel={`Play ${item.name}`}
    >
      {item.catalog?.thumbnail ? (
        <Image source={{ uri: item.catalog.thumbnail }} style={styles.replayArtwork} />
      ) : (
        <View style={[styles.replayArtwork, styles.fallback]}><Ionicons name="play-circle" size={44} color={colors.mint} /></View>
      )}
      <View style={styles.cardCopy}>
        <Text style={styles.cardMeta}>{item.catalog?.sport || "Sport"} · {item.catalog?.publisher || item.rightsOwner}</Text>
        <Text numberOfLines={2} style={styles.cardTitle}>{item.name}</Text>
      </View>
    </Pressable>
  );
});

export function Player({ title, sources, visible, onClose }: { title: string; sources: Source[]; visible: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const active = sources[index];
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <View style={styles.playerPage}>
        <View style={styles.playerHeader}>
          <Brand compact />
          <Text style={styles.playerTitle} numberOfLines={1}>{title}</Text>
          <FocusButton icon="close" onPress={onClose}>Close</FocusButton>
        </View>
        <View style={styles.playerFrame}>
          {active ? (
            <WebView
              key={active.url}
              source={{ uri: active.url }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback
            />
          ) : (
            <View style={styles.playerEmpty}><Text style={styles.emptyTitle}>No playable source</Text></View>
          )}
        </View>
        {sources.length > 1 && (
          <View style={styles.sourceBar}>
            {sources.map((source, sourceIndex) => (
              <FocusButton key={source.id} selected={index === sourceIndex} onPress={() => setIndex(sourceIndex)}>
                {source.label || `Stream ${sourceIndex + 1}`}
              </FocusButton>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandBall: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panelRaised, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  brandText: { color: colors.ink, fontSize: 27, fontWeight: "900", letterSpacing: -1.2 },
  brandAccent: { color: colors.mint },
  focusButton: { minHeight: Platform.isTV ? 54 : 44, paddingHorizontal: Platform.isTV ? 22 : 16, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.panel },
  focusButtonSelected: { backgroundColor: colors.mint, borderColor: colors.mint },
  focusButtonFocused: { backgroundColor: colors.lime, borderColor: colors.ink, transform: [{ scale: 1.06 }] },
  focusButtonText: { color: colors.ink, fontSize: Platform.isTV ? 17 : 14, fontWeight: "800" },
  focusButtonTextActive: { color: colors.canvasDeep },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  card: { borderRadius: radii.md, overflow: "hidden", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, marginRight: Platform.isTV ? 22 : 14 },
  cardFocused: { borderColor: colors.lime, transform: [{ scale: 1.045 }], shadowColor: colors.mint, shadowOpacity: 0.45, shadowRadius: 22, elevation: 12 },
  cardArtwork: { alignItems: "center", justifyContent: "center", backgroundColor: "#063128" },
  cardImage: { resizeMode: "cover" },
  livePill: { position: "absolute", left: 12, bottom: 11, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radii.pill, backgroundColor: "rgba(1,17,13,.88)" },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger },
  liveText: { color: colors.ink, fontWeight: "900", fontSize: 10, letterSpacing: 0.7 },
  saveButton: { position: "absolute", right: 10, top: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(1,17,13,.72)", alignItems: "center", justifyContent: "center" },
  cardCopy: { padding: Platform.isTV ? 17 : 14, gap: 6 },
  cardMeta: { color: colors.mint, fontSize: Platform.isTV ? 14 : 11, fontWeight: "700" },
  cardTitle: { color: colors.ink, fontSize: Platform.isTV ? 21 : 16, lineHeight: Platform.isTV ? 27 : 21, fontWeight: "900" },
  cardSources: { color: colors.muted, fontSize: Platform.isTV ? 14 : 12, fontWeight: "700" },
  replayCard: { width: Platform.isTV ? 360 : 260, marginRight: Platform.isTV ? 22 : 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, borderRadius: radii.md, overflow: "hidden" },
  replayArtwork: { width: "100%", height: Platform.isTV ? 190 : 140, resizeMode: "cover" },
  fallback: { backgroundColor: colors.panelRaised, alignItems: "center", justifyContent: "center" },
  playerPage: { flex: 1, backgroundColor: colors.canvasDeep },
  playerHeader: { height: Platform.isTV ? 86 : 70, paddingHorizontal: Platform.isTV ? 40 : 18, flexDirection: "row", alignItems: "center", gap: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  playerTitle: { flex: 1, color: colors.ink, fontSize: Platform.isTV ? 22 : 16, fontWeight: "800" },
  playerFrame: { flex: 1, margin: Platform.isTV ? 30 : 0, borderRadius: Platform.isTV ? radii.lg : 0, overflow: "hidden", backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
  playerEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  sourceBar: { minHeight: Platform.isTV ? 90 : 72, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
});
