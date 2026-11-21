import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, G, Mask, Path } from "react-native-svg";
import { colors, radii } from "./theme";
import type { Broadcast, Source, Video } from "./types";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.brand} accessibilityLabel="backinit">
      <View style={[styles.brandBall, compact && { width: 30, height: 30 }]}>
        <BrandMark size={compact ? 30 : 40} />
      </View>
      <Text style={[styles.brandText, compact && { fontSize: 21 }]}>back<Text style={styles.brandAccent}>in</Text>it<Text style={styles.brandAccent}>.</Text></Text>
    </View>
  );
}

export function BrandMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 0.64} viewBox="0 0 100 64" accessibilityLabel="backinit mark">
      <Defs>
        <Mask id="backinit-ball">
          <Circle cx="50" cy="32" r="25" fill="#fff" />
          <Path d="M50 21 60.5 28.6 56.5 41 43.5 41 39.5 28.6Z M50 21V7 M60.5 28.6 74 23 M56.5 41 65 54 M43.5 41 35 54 M39.5 28.6 26 23" fill="none" stroke="#000" strokeWidth="3" strokeLinejoin="round" />
        </Mask>
      </Defs>
      <G fill={colors.ink}>
        <Circle cx="50" cy="32" r="25" mask="url(#backinit-ball)" />
        <Path d="M16 13a31 31 0 0 0 0 38 M84 13a31 31 0 0 1 0 38" fill="none" stroke={colors.ink} strokeWidth="7" strokeLinecap="round" />
      </G>
    </Svg>
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
  fullWidth = false,
}: {
  item: Broadcast;
  saved: boolean;
  onPlay: (item: Broadcast) => void;
  onSave: (id: string) => void;
  large?: boolean;
  fullWidth?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const width = Platform.isTV ? (large ? 350 : 270) : large ? 330 : 244;
  return (
    <Pressable
      onPress={() => onPlay(item)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={`Watch ${item.title}`}
      style={[styles.card, { width: fullWidth ? "100%" : width, marginRight: fullWidth ? 0 : styles.card.marginRight }, focused && styles.cardFocused]}
    >
      <ImageBackground
        source={item.poster && !posterFailed ? { uri: item.poster } : undefined}
        onError={() => setPosterFailed(true)}
        style={[styles.cardArtwork, { height: Platform.isTV ? 145 : 138 }]}
        imageStyle={styles.cardImage}
      >
        {(!item.poster || posterFailed) && <BrandMark size={64} />}
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

export const ReplayCard = memo(function ReplayCard({ item, onPlay, fullWidth = false }: { item: Video; onPlay: (item: Video) => void; fullWidth?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={() => onPlay(item)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[styles.replayCard, fullWidth && { width: "100%", marginRight: 0 }, focused && styles.cardFocused]}
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
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const active = sources[index];
  useEffect(() => {
    setIndex(0);
    setState("loading");
  }, [title, visible]);
  useEffect(() => {
    if (!visible || state !== "loading") return;
    const timeout = setTimeout(() => setState("error"), 12000);
    return () => clearTimeout(timeout);
  }, [reloadKey, index, state, visible]);
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait", "landscape"]}>
      <View style={[styles.playerPage, { paddingBottom: insets.bottom }]}>
        <View style={styles.playerHeader}>
          <Brand compact />
          <Text style={styles.playerTitle} numberOfLines={1}>{title}</Text>
          <FocusButton icon="close" onPress={onClose}>Close</FocusButton>
        </View>
        <View style={styles.playerFrame}>
          {active ? (
            <>
            <WebView
              key={`${active.url}-${reloadKey}`}
              source={{ uri: active.url }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              allowsFullscreenVideo
              mediaPlaybackRequiresUserAction={false}
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback
              thirdPartyCookiesEnabled
              sharedCookiesEnabled
              mixedContentMode="compatibility"
              onLoadStart={() => setState("loading")}
              injectedJavaScript={`setTimeout(function(){try{window.ReactNativeWebView.postMessage(String((document.documentElement&&document.documentElement.innerHTML||'').length))}catch(e){}},1200);true;`}
              onMessage={(event) => setState(Number(event.nativeEvent.data) > 100 ? "ready" : "error")}
              onError={() => setState("error")}
              onHttpError={() => setState("error")}
            />
            {state !== "ready" && (
              <View style={styles.playerStatus} pointerEvents="box-none">
                <BrandMark size={58} />
                <Text style={styles.playerStatusTitle}>{state === "error" ? "This stream did not load" : "Connecting to stream"}</Text>
                <Text style={styles.playerStatusCopy}>{state === "error" ? "Try again or choose another stream source." : "Some providers can take a few seconds to respond."}</Text>
                {state === "error" && <FocusButton icon="refresh" onPress={() => { setState("loading"); setReloadKey((value) => value + 1); }}>Retry</FocusButton>}
              </View>
            )}
            </>
          ) : (
            <View style={styles.playerEmpty}><Text style={styles.emptyTitle}>No playable source</Text></View>
          )}
        </View>
        {sources.length > 0 && (
          <View style={styles.sourceBar}>
            {sources.map((source, sourceIndex) => (
              <FocusButton key={source.id} selected={index === sourceIndex} onPress={() => setIndex(sourceIndex)}>
                {source.label || `Stream ${sourceIndex + 1}`}
              </FocusButton>
            ))}
            <FocusButton icon="refresh" onPress={() => { setState("loading"); setReloadKey((value) => value + 1); }}>Reload</FocusButton>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandBall: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  brandText: { color: colors.ink, fontSize: 27, fontWeight: "900", letterSpacing: -1.2 },
  brandAccent: { color: colors.mint },
  focusButton: { minHeight: Platform.isTV ? 48 : 44, paddingHorizontal: Platform.isTV ? 18 : 16, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.panel },
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
  replayCard: { width: Platform.isTV ? 280 : 260, marginRight: Platform.isTV ? 18 : 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, borderRadius: radii.md, overflow: "hidden" },
  replayArtwork: { width: "100%", height: Platform.isTV ? 150 : 140, resizeMode: "cover" },
  fallback: { backgroundColor: colors.panelRaised, alignItems: "center", justifyContent: "center" },
  playerPage: { flex: 1, backgroundColor: colors.canvasDeep },
  playerHeader: { height: Platform.isTV ? 86 : 70, paddingHorizontal: Platform.isTV ? 40 : 18, flexDirection: "row", alignItems: "center", gap: 18, borderBottomWidth: 1, borderBottomColor: colors.line },
  playerTitle: { flex: 1, color: colors.ink, fontSize: Platform.isTV ? 22 : 16, fontWeight: "800" },
  playerFrame: { flex: 1, margin: Platform.isTV ? 30 : 0, borderRadius: Platform.isTV ? radii.lg : 0, overflow: "hidden", backgroundColor: "#000" },
  webview: { flex: 1, backgroundColor: "#000" },
  playerStatus: { position: "absolute", inset: 0, backgroundColor: "rgba(1,17,13,.94)", alignItems: "center", justifyContent: "center", gap: 12, padding: 28 },
  playerStatusTitle: { color: colors.ink, fontSize: Platform.isTV ? 26 : 20, fontWeight: "900", textAlign: "center" },
  playerStatusCopy: { color: colors.muted, fontSize: Platform.isTV ? 17 : 14, lineHeight: Platform.isTV ? 25 : 21, textAlign: "center", maxWidth: 520 },
  playerEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  sourceBar: { minHeight: Platform.isTV ? 90 : 72, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
});
