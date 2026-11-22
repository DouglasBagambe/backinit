import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, G, Mask, Path } from "react-native-svg";
import { radii, type ThemeColors } from "./theme";
import { useTheme } from "./appearance";
import type { Broadcast, Source, Video } from "./types";
import { isPlayerNavigationAllowed } from "./player-navigation";
import { nativePlayerDocument } from "./player-embed";
import { playerAudioScript } from "./player-audio";
import { playerHardeningScript } from "./player-hardening";

// react-native-webview's published FunctionComponent type omits its imperative
// ref even though the native component exposes injectJavaScript at runtime.
const ControllableWebView = WebView as any;

export function Brand({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.brand} accessibilityLabel="backinit">
      <View style={[styles.brandBall, compact && { width: 30, height: 30 }]}>
        <BrandMark size={compact ? 30 : 40} />
      </View>
      <Text style={[styles.brandText, compact && { fontSize: 21 }]}>
        back<Text style={styles.brandAccent}>in</Text>it
        <Text style={styles.brandAccent}>.</Text>
      </Text>
    </View>
  );
}

export function BrandMark({ size }: { size: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Svg
      width={size}
      height={size * 0.64}
      viewBox="0 0 100 64"
      accessibilityLabel="backinit mark"
    >
      <Defs>
        <Mask id="backinit-ball">
          <Circle cx="50" cy="32" r="25" fill="#fff" />
          <Path
            d="M50 21 60.5 28.6 56.5 41 43.5 41 39.5 28.6Z M50 21V7 M60.5 28.6 74 23 M56.5 41 65 54 M43.5 41 35 54 M39.5 28.6 26 23"
            fill="none"
            stroke="#000"
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </Mask>
      </Defs>
      <G fill={colors.ink}>
        <Circle cx="50" cy="32" r="25" mask="url(#backinit-ball)" />
        <Path
          d="M16 13a31 31 0 0 0 0 38 M84 13a31 31 0 0 1 0 38"
          fill="none"
          stroke={colors.ink}
          strokeWidth="7"
          strokeLinecap="round"
        />
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
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
        props.disabled && { opacity: 0.45 },
        style as object,
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={Platform.isTV ? 23 : 20}
          color={
            focused ? "#01110D" : selected ? colors.canvasDeep : colors.ink
          }
        />
      )}
      <Text
        numberOfLines={2}
        style={[
          styles.focusButtonText,
          { flexShrink: 1 },
          selected && styles.focusButtonTextActive,
          focused && { color: "#01110D" },
        ]}
      >
        {children}
      </Text>
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
  cardWidth,
}: {
  item: Broadcast;
  saved: boolean;
  onPlay: (item: Broadcast) => void;
  onSave: (id: string) => void;
  large?: boolean;
  fullWidth?: boolean;
  cardWidth?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const width =
    cardWidth ?? (Platform.isTV ? (large ? 350 : 270) : large ? 330 : 244);
  return (
    <Pressable
      onPress={() => onPlay(item)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={`Watch ${item.title}`}
      style={[
        styles.card,
        {
          width: fullWidth ? "100%" : width,
          marginRight: fullWidth || cardWidth ? 0 : styles.card.marginRight,
        },
        focused && styles.cardFocused,
      ]}
    >
      <ImageBackground
        source={item.poster && !posterFailed ? { uri: item.poster } : undefined}
        onError={() => setPosterFailed(true)}
        style={[
          styles.cardArtwork,
          {
            height: cardWidth
              ? (cardWidth * 9) / 16
              : Platform.isTV
                ? 145
                : 138,
          },
        ]}
        imageStyle={[
          styles.cardImage,
          item.channel && { resizeMode: "contain" },
        ]}
      >
        {(!item.poster || posterFailed) && <BrandMark size={64} />}
        <LinearGradient
          colors={["transparent", "rgba(1,17,13,.88)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>
            {item.channel
              ? "LIVE 24/7"
              : item.live ||
                  (item.start <= Date.now() && item.end >= Date.now())
                ? "LIVE"
                : "UPCOMING"}
          </Text>
        </View>
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onSave(item.id);
          }}
          style={styles.saveButton}
          accessibilityLabel={saved ? "Remove from saved" : "Save channel"}
        >
          <Ionicons
            name={saved ? "bookmark" : "bookmark-outline"}
            size={21}
            color={saved ? "#C8FF73" : "#F4FFF9"}
          />
        </Pressable>
      </ImageBackground>
      <View style={styles.cardCopy}>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {item.category} · {item.competition}
        </Text>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.cardSources}>
          {item.sources.length} stream{item.sources.length === 1 ? "" : "s"}
        </Text>
      </View>
    </Pressable>
  );
});

export const ReplayCard = memo(function ReplayCard({
  item,
  onPlay,
  fullWidth = false,
  cardWidth,
}: {
  item: Video;
  onPlay: (item: Video) => void;
  fullWidth?: boolean;
  cardWidth?: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={() => onPlay(item)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[
        styles.replayCard,
        fullWidth && { width: "100%", marginRight: 0 },
        cardWidth !== undefined && { width: cardWidth, marginRight: 0 },
        focused && styles.cardFocused,
      ]}
      accessibilityLabel={`Play ${item.name}`}
    >
      {item.catalog?.thumbnail ? (
        <Image
          source={{ uri: item.catalog.thumbnail }}
          style={[
            styles.replayArtwork,
            cardWidth !== undefined && { height: (cardWidth * 9) / 16 },
          ]}
        />
      ) : (
        <View
          style={[
            styles.replayArtwork,
            cardWidth !== undefined && { height: (cardWidth * 9) / 16 },
            styles.fallback,
          ]}
        >
          <Ionicons name="play-circle" size={44} color={colors.mint} />
        </View>
      )}
      <View style={styles.cardCopy}>
        <Text style={styles.cardMeta}>
          {item.catalog?.sport || "Sport"} ·{" "}
          {item.catalog?.publisher || item.rightsOwner}
        </Text>
        <Text numberOfLines={2} style={styles.cardTitle}>
          {item.name}
        </Text>
      </View>
    </Pressable>
  );
});

export function Player({
  title,
  sources,
  visible,
  onClose,
}: {
  title: string;
  sources: Source[];
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [muted, setMuted] = useState(false);
  const [theater, setTheater] = useState(false);
  const webview = useRef<{ injectJavaScript: (script: string) => void } | null>(
    null,
  );
  const active = sources[index];
  useEffect(() => {
    setIndex(0);
    setState("loading");
    setMuted(false);
    setTheater(false);
  }, [title, visible]);
  useEffect(() => {
    if (!visible) return;
    webview.current?.injectJavaScript(playerAudioScript(muted));
  }, [muted, index, reloadKey, visible]);
  useEffect(() => {
    if (!visible || state !== "loading") return;
    const timeout = setTimeout(() => setState("error"), 12000);
    return () => clearTimeout(timeout);
  }, [reloadKey, index, state, visible]);
  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <View
        style={[
          styles.playerPage,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        {!theater && (
          <View style={styles.playerHeader}>
            <Brand compact />
            <Text style={styles.playerTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>
        )}
        <View
          style={[styles.playerFrame, theater && styles.playerFrameTheater]}
        >
          {active ? (
            <>
              <ControllableWebView
                ref={webview}
                key={`${active.url}-${reloadKey}`}
                source={nativePlayerDocument(active.url)}
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
                androidLayerType="hardware"
                cacheEnabled
                setBuiltInZoomControls={false}
                allowsBackForwardNavigationGestures={false}
                injectedJavaScriptBeforeContentLoaded={playerHardeningScript}
                onOpenWindow={() => undefined}
                onShouldStartLoadWithRequest={(request: {
                  url: string;
                  isTopFrame?: boolean;
                }) =>
                  request.isTopFrame === false ||
                  request.url === "https://backinit.live/" ||
                  isPlayerNavigationAllowed(active.url, request.url)
                }
                onLoadStart={() => setState("loading")}
                onLoadEnd={() =>
                  webview.current?.injectJavaScript(playerAudioScript(muted))
                }
                injectedJavaScript={`setTimeout(function(){try{window.ReactNativeWebView.postMessage(String((document.documentElement&&document.documentElement.innerHTML||'').length))}catch(e){}},1200);true;`}
                onMessage={(event: { nativeEvent: { data: string } }) =>
                  setState(
                    Number(event.nativeEvent.data) > 100 ? "ready" : "error",
                  )
                }
                onError={() => setState("error")}
                onHttpError={() => setState("error")}
              />
              {state !== "ready" && (
                <View style={styles.playerStatus} pointerEvents="box-none">
                  <BrandMark size={58} />
                  <Text style={styles.playerStatusTitle}>
                    {state === "error"
                      ? "This stream did not load"
                      : "Connecting to stream"}
                  </Text>
                  <Text style={styles.playerStatusCopy}>
                    {state === "error"
                      ? "Try again or choose another stream source."
                      : "Some providers can take a few seconds to respond."}
                  </Text>
                  {state === "error" && (
                    <FocusButton
                      icon="refresh"
                      onPress={() => {
                        setState("loading");
                        setReloadKey((value) => value + 1);
                      }}
                    >
                      Retry
                    </FocusButton>
                  )}
                </View>
              )}
            </>
          ) : (
            <View style={styles.playerEmpty}>
              <Text style={styles.emptyTitle}>No playable source</Text>
            </View>
          )}
        </View>
        {sources.length > 0 && (
          <ScrollView
            horizontal
            style={{
              flexGrow: 0,
              flexShrink: 0,
              height: Platform.isTV ? 78 : 72,
            }}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sourceBar}
          >
            {sources.map((source, sourceIndex) => (
              <FocusButton
                key={source.id}
                selected={index === sourceIndex}
                onPress={() => setIndex(sourceIndex)}
              >
                {source.label || `Stream ${sourceIndex + 1}`}
              </FocusButton>
            ))}
            <FocusButton
              icon={muted ? "volume-mute" : "volume-high"}
              selected={muted}
              onPress={() => setMuted((value) => !value)}
              accessibilityLabel={muted ? "Unmute stream" : "Mute stream"}
            >
              {muted ? "Unmute" : "Mute"}
            </FocusButton>
            <FocusButton
              icon={theater ? "contract" : "expand"}
              selected={theater}
              onPress={() => setTheater((value) => !value)}
              accessibilityLabel={
                theater ? "Exit theater view" : "Theater view"
              }
            >
              {theater ? "Exit theater" : "Theater"}
            </FocusButton>
            <FocusButton
              icon="refresh"
              onPress={() => {
                setState("loading");
                setReloadKey((value) => value + 1);
              }}
            >
              Reload
            </FocusButton>
            <FocusButton icon="close" onPress={onClose}>
              Close
            </FocusButton>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    brand: { flexDirection: "row", alignItems: "center", gap: 9 },
    brandBall: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    brandText: {
      color: colors.ink,
      fontSize: 27,
      fontWeight: "900",
      letterSpacing: -1.2,
    },
    brandAccent: { color: colors.mint },
    focusButton: {
      minHeight: Platform.isTV ? 44 : 44,
      paddingHorizontal: Platform.isTV ? 15 : 16,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.panel,
    },
    focusButtonSelected: {
      backgroundColor: colors.mint,
      borderColor: colors.mint,
    },
    focusButtonFocused: {
      backgroundColor: colors.lime,
      borderColor: colors.ink,
      transform: [{ scale: 1.035 }],
      shadowColor: colors.lime,
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 10,
    },
    focusButtonText: {
      color: colors.ink,
      fontSize: Platform.isTV ? 15 : 14,
      fontWeight: "800",
    },
    focusButtonTextActive: { color: colors.canvasDeep },
    pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
    card: {
      borderRadius: radii.md,
      overflow: "hidden",
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: colors.line,
      marginRight: Platform.isTV ? 22 : 14,
    },
    cardFocused: {
      borderColor: colors.lime,
      transform: [{ scale: 1.025 }],
      shadowColor: colors.mint,
      shadowOpacity: 0.45,
      shadowRadius: 22,
      elevation: 12,
    },
    cardArtwork: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#063128",
    },
    cardImage: { resizeMode: "cover" },
    livePill: {
      position: "absolute",
      left: 12,
      bottom: 11,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: radii.pill,
      backgroundColor: "rgba(1,17,13,.88)",
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.danger,
    },
    liveText: {
      color: "#F4FFF9",
      fontWeight: "900",
      fontSize: 10,
      letterSpacing: 0.7,
    },
    saveButton: {
      position: "absolute",
      right: 10,
      top: 10,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: "rgba(1,17,13,.72)",
      alignItems: "center",
      justifyContent: "center",
    },
    cardCopy: { padding: Platform.isTV ? 14 : 14, gap: 5 },
    cardMeta: {
      color: colors.mint,
      fontSize: Platform.isTV ? 12 : 11,
      fontWeight: "700",
    },
    cardTitle: {
      minHeight: Platform.isTV ? 46 : 42,
      color: colors.ink,
      fontSize: Platform.isTV ? 18 : 16,
      lineHeight: Platform.isTV ? 23 : 21,
      fontWeight: "900",
    },
    cardSources: {
      color: colors.muted,
      fontSize: Platform.isTV ? 12 : 12,
      fontWeight: "700",
    },
    replayCard: {
      width: Platform.isTV ? 280 : 260,
      marginRight: Platform.isTV ? 18 : 14,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    replayArtwork: {
      width: "100%",
      height: Platform.isTV ? 150 : 140,
      resizeMode: "cover",
    },
    fallback: {
      backgroundColor: colors.panelRaised,
      alignItems: "center",
      justifyContent: "center",
    },
    playerPage: { flex: 1, backgroundColor: colors.canvasDeep },
    playerHeader: {
      height: Platform.isTV ? 86 : 70,
      paddingHorizontal: Platform.isTV ? 40 : 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    playerTitle: {
      flex: 1,
      color: colors.ink,
      fontSize: Platform.isTV ? 22 : 16,
      fontWeight: "800",
    },
    playerFrame: {
      flex: 1,
      margin: Platform.isTV ? 12 : 0,
      borderRadius: Platform.isTV ? radii.lg : 0,
      overflow: "hidden",
      backgroundColor: "#000",
    },
    playerFrameTheater: {
      margin: 0,
      borderRadius: 0,
    },
    webview: { flex: 1, backgroundColor: "#000" },
    playerStatus: {
      position: "absolute",
      inset: 0,
      backgroundColor: colors.panel,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 28,
    },
    playerStatusTitle: {
      color: colors.ink,
      fontSize: Platform.isTV ? 26 : 20,
      fontWeight: "900",
      textAlign: "center",
    },
    playerStatusCopy: {
      color: colors.muted,
      fontSize: Platform.isTV ? 17 : 14,
      lineHeight: Platform.isTV ? 25 : 21,
      textAlign: "center",
      maxWidth: 520,
    },
    playerEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyTitle: { color: colors.ink, fontSize: 22, fontWeight: "800" },
    sourceBar: {
      minHeight: Platform.isTV ? 78 : 72,
      paddingHorizontal: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
  });
