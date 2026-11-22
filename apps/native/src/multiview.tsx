import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Brand, BrandMark, FocusButton } from "./components";
import { nativePlayerDocument } from "./player-embed";
import { setPlayerAudio } from "./native-player-audio";
import { playerHardeningScript } from "./player-hardening";
import { isPlayerNavigationAllowed } from "./player-navigation";
import { radii, type ThemeColors } from "./theme";
import { useTheme } from "./appearance";
import type { Broadcast } from "./types";

const isTV = Platform.isTV;
const maxTiles = isTV ? 4 : 2;
const ControllableWebView = WebView as any;
type WebViewHandle = { injectJavaScript: (script: string) => void };

export function Multiview({ broadcasts }: { broadcasts: Broadcast[] }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const playable = useMemo(() => {
    const seen = new Set<string>();
    return broadcasts.filter((item) => {
      if (!item.sources.length || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [broadcasts]);
  const [selected, setSelected] = useState<Broadcast[]>([]);
  const [query, setQuery] = useState("");
  const [wallOpen, setWallOpen] = useState(false);
  const matches = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (
      term
        ? playable.filter((item) =>
            `${item.title} ${item.category} ${item.competition}`
              .toLowerCase()
              .includes(term),
          )
        : playable
    ).slice(0, isTV ? 60 : 36);
  }, [playable, query]);
  const add = (item: Broadcast) => {
    setSelected((items) =>
      items.some((entry) => entry.id === item.id) || items.length >= maxTiles
        ? items
        : [...items, item],
    );
  };
  return (
    <>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>YOUR CONTROL ROOM</Text>
        <Text style={styles.title}>Multiview</Text>
        <Text style={styles.description}>
          Watch {maxTiles} streams together. Choose one audio feed, expand any
          tile, and switch sources without touching an embedded player.
        </Text>
      </View>
      <View style={styles.builder}>
        <View style={styles.builderHeader}>
          <View>
            <Text style={styles.builderTitle}>Build your wall</Text>
            <Text style={styles.builderMeta}>
              {selected.length} of {maxTiles} streams selected
            </Text>
          </View>
          <FocusButton
            icon="grid"
            selected={selected.length > 0}
            disabled={!selected.length}
            onPress={() => setWallOpen(true)}
          >
            Open Multiview
          </FocusButton>
        </View>
        <View style={styles.slots}>
          {Array.from({ length: maxTiles }).map((_, index) => {
            const item = selected[index];
            return (
              <View key={item?.id || `empty-${index}`} style={styles.slot}>
                {item?.poster ? (
                  <Image
                    source={{ uri: item.poster }}
                    style={styles.slotImage}
                  />
                ) : (
                  <View style={styles.slotMark}>
                    <BrandMark size={42} />
                  </View>
                )}
                <View style={styles.slotCopy}>
                  <Text style={styles.slotNumber}>VIEW {index + 1}</Text>
                  <Text style={styles.slotTitle} numberOfLines={1}>
                    {item?.title || "Choose a stream"}
                  </Text>
                </View>
                {item && (
                  <Pressable
                    onPress={() =>
                      setSelected((items) =>
                        items.filter((entry) => entry.id !== item.id),
                      )
                    }
                    style={styles.remove}
                    accessibilityLabel={`Remove ${item.title}`}
                  >
                    <Ionicons name="close" color={colors.ink} size={20} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      </View>
      <View style={styles.search}>
        <Ionicons name="search" size={20} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find a match, channel or sport"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Available now</Text>
        <Text style={styles.builderMeta}>{playable.length} streams</Text>
      </View>
      <View style={styles.pickerGrid}>
        {matches.map((item) => {
          const added = selected.some((entry) => entry.id === item.id);
          return (
            <FocusButton
              key={item.id}
              icon={added ? "checkmark-circle" : "add-circle-outline"}
              selected={added}
              disabled={!added && selected.length >= maxTiles}
              onPress={() =>
                added
                  ? setSelected((items) =>
                      items.filter((entry) => entry.id !== item.id),
                    )
                  : add(item)
              }
              style={styles.pickButton}
            >
              {item.title}
            </FocusButton>
          );
        })}
      </View>
      {wallOpen && (
        <MultiviewWall
          visible={wallOpen}
          initial={selected}
          onClose={() => setWallOpen(false)}
          onChange={setSelected}
        />
      )}
    </>
  );
}

function MultiviewWall({
  visible,
  initial,
  onClose,
  onChange,
}: {
  visible: boolean;
  initial: Broadcast[];
  onClose: () => void;
  onChange: (items: Broadcast[]) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [sourceIndexes, setSourceIndexes] = useState<Record<string, number>>(
    {},
  );
  const [reloads, setReloads] = useState<Record<string, number>>({});
  const [audible, setAudible] = useState<string | null>(initial[0]?.id || null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const refs = useRef<Record<string, WebViewHandle | null>>({});
  const nativeTags = useRef<Record<string, number | null>>({});
  const [wallSize, setWallSize] = useState({ width: 0, height: 0 });

  const shown = initial;
  useEffect(() => {
    initial.forEach(
      (item) =>
        void setPlayerAudio(
          refs.current[item.id],
          nativeTags.current[item.id],
          audible !== item.id,
        ),
    );
  }, [audible, initial]);
  const setAudio = (id: string) => {
    const next = audible === id ? null : id;
    setAudible(next);
    initial.forEach(
      (item) =>
        void setPlayerAudio(
          refs.current[item.id],
          nativeTags.current[item.id],
          next !== item.id,
        ),
    );
  };
  const remove = (id: string) => {
    const next = initial.filter((item) => item.id !== id);
    onChange(next);
    if (expanded === id) setExpanded(null);
    if (audible === id) setAudible(next[0]?.id || null);
    if (!next.length) onClose();
  };
  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      supportedOrientations={["portrait", "landscape"]}
    >
      <View
        style={[
          styles.wall,
          { paddingTop: insets.top, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.wallHeader}>
          <Brand compact />
          <View style={styles.wallHeading}>
            <Text style={styles.wallTitle}>Multiview</Text>
            <Text style={styles.wallMeta}>
              {initial.length} views · {audible ? "one audio feed" : "muted"}
            </Text>
          </View>
          <FocusButton icon="close" onPress={onClose}>
            Exit
          </FocusButton>
        </View>
        <View
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setWallSize((current) =>
              current.width === width && current.height === height
                ? current
                : { width, height },
            );
          }}
          style={[
            styles.wallGrid,
            (expanded !== null || shown.length === 1) && styles.wallGridSingle,
          ]}
        >
          {shown.map((item) => {
            const index = Math.min(
              sourceIndexes[item.id] || 0,
              item.sources.length - 1,
            );
            const source = item.sources[index]!;
            const muted = audible !== item.id;
            return (
              <View
                key={`${item.id}-${reloads[item.id] || 0}`}
                style={[
                  styles.tile,
                  wallSize.width > 0 && {
                    width:
                      expanded === item.id || shown.length === 1 || !isTV
                        ? wallSize.width
                        : (wallSize.width - 2) / 2,
                    height:
                      expanded === item.id ||
                      shown.length === 1 ||
                      (isTV && shown.length === 2)
                        ? wallSize.height
                        : (wallSize.height - 2) / 2,
                  },
                  (expanded === item.id || shown.length === 1) &&
                    styles.tileSingle,
                  expanded !== null &&
                    expanded !== item.id &&
                    styles.tileHidden,
                ]}
              >
                <ControllableWebView
                  ref={(ref: WebViewHandle | null) => {
                    refs.current[item.id] = ref;
                    if (!ref) nativeTags.current[item.id] = null;
                  }}
                  onLoadStart={(event: { nativeEvent: { target: number } }) => {
                    nativeTags.current[item.id] = event.nativeEvent.target;
                    void setPlayerAudio(
                      refs.current[item.id],
                      nativeTags.current[item.id],
                      muted,
                    );
                  }}
                  source={nativePlayerDocument(source.url)}
                  style={styles.tileWebview}
                  javaScriptEnabled
                  domStorageEnabled
                  allowsFullscreenVideo
                  mediaPlaybackRequiresUserAction={false}
                  setSupportMultipleWindows={false}
                  allowsInlineMediaPlayback
                  cacheEnabled
                  androidLayerType="hardware"
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
                    isPlayerNavigationAllowed(source.url, request.url)
                  }
                  onLoadEnd={() =>
                    void setPlayerAudio(
                      refs.current[item.id],
                      nativeTags.current[item.id],
                      muted,
                    )
                  }
                />
                <View style={styles.tileTop} pointerEvents="none">
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>
                      {item.channel ||
                      item.live ||
                      (item.start <= Date.now() && item.end >= Date.now())
                        ? "LIVE"
                        : "UPCOMING"}
                    </Text>
                  </View>
                  <Text style={styles.tileTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.tileControls}
                  contentContainerStyle={styles.tileControlsInner}
                >
                  <FocusButton
                    icon={muted ? "volume-mute" : "volume-high"}
                    selected={!muted}
                    onPress={() => setAudio(item.id)}
                  >
                    {muted ? "Listen" : "Audio on"}
                  </FocusButton>
                  <FocusButton
                    icon={expanded === item.id ? "contract" : "expand"}
                    onPress={() =>
                      setExpanded((value) =>
                        value === item.id ? null : item.id,
                      )
                    }
                  >
                    {expanded === item.id ? "Grid" : "Expand"}
                  </FocusButton>
                  {item.sources.length > 1 && (
                    <FocusButton
                      icon="swap-horizontal"
                      onPress={() =>
                        setSourceIndexes((values) => ({
                          ...values,
                          [item.id]: (index + 1) % item.sources.length,
                        }))
                      }
                    >
                      Stream {index + 1}/{item.sources.length}
                    </FocusButton>
                  )}
                  <FocusButton
                    icon="refresh"
                    onPress={() =>
                      setReloads((values) => ({
                        ...values,
                        [item.id]: (values[item.id] || 0) + 1,
                      }))
                    }
                  >
                    Reload
                  </FocusButton>
                  <FocusButton icon="close" onPress={() => remove(item.id)}>
                    Remove
                  </FocusButton>
                </ScrollView>
              </View>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    intro: { padding: isTV ? 28 : 20, paddingBottom: 16, gap: 6 },
    eyebrow: {
      color: colors.mint,
      fontWeight: "900",
      fontSize: 11,
      letterSpacing: 1.6,
    },
    title: {
      color: colors.ink,
      fontSize: isTV ? 36 : 30,
      fontWeight: "900",
      letterSpacing: -1,
    },
    description: {
      color: colors.muted,
      maxWidth: 760,
      fontSize: isTV ? 15 : 14,
      lineHeight: isTV ? 22 : 21,
    },
    builder: {
      marginHorizontal: isTV ? 28 : 18,
      padding: isTV ? 20 : 16,
      backgroundColor: colors.panel,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: radii.lg,
      gap: 16,
    },
    builderHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    },
    builderTitle: {
      color: colors.ink,
      fontSize: isTV ? 22 : 19,
      fontWeight: "900",
    },
    builderMeta: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 3,
    },
    slots: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    slot: {
      width: isTV ? "49%" : "100%",
      height: isTV ? 72 : 64,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.canvasDeep,
      borderColor: colors.line,
      borderWidth: 1,
      borderRadius: radii.md,
      overflow: "hidden",
    },
    slotImage: { width: 104, height: isTV ? 72 : 64, resizeMode: "cover" },
    slotMark: {
      width: 76,
      height: isTV ? 72 : 64,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.panelRaised,
    },
    slotCopy: { flex: 1, paddingHorizontal: 12, gap: 3 },
    slotNumber: {
      color: colors.mint,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },
    slotTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
    remove: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 6,
      borderRadius: 21,
      backgroundColor: colors.panel,
    },
    search: {
      marginHorizontal: isTV ? 28 : 18,
      marginTop: 22,
      height: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
    },
    searchInput: { flex: 1, color: colors.ink, fontSize: 15 },
    pickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginHorizontal: isTV ? 28 : 18,
      marginTop: 18,
      marginBottom: 10,
    },
    pickerTitle: { color: colors.ink, fontSize: 19, fontWeight: "900" },
    pickerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      paddingHorizontal: isTV ? 28 : 18,
    },
    pickButton: {
      width: isTV ? "32%" : "100%",
      justifyContent: "flex-start",
      paddingHorizontal: 14,
    },
    wall: { flex: 1, backgroundColor: "#000" },
    wallHeader: {
      minHeight: isTV ? 70 : 62,
      paddingHorizontal: isTV ? 24 : 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: colors.canvasDeep,
      borderBottomColor: colors.line,
      borderBottomWidth: 1,
    },
    wallHeading: { flex: 1 },
    wallTitle: {
      color: colors.ink,
      fontSize: isTV ? 20 : 16,
      fontWeight: "900",
    },
    wallMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
    wallGrid: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 2,
      backgroundColor: colors.line,
    },
    wallGridSingle: { flexWrap: "nowrap" },
    tile: {
      width: isTV ? "49.7%" : "100%",
      height: isTV ? "49.8%" : "50%",
      backgroundColor: "#000",
      overflow: "hidden",
    },
    tileSingle: { width: "100%", height: "100%" },
    tileHidden: { position: "absolute", width: 0, height: 0, opacity: 0 },
    tileWebview: { flex: 1, backgroundColor: "#000" },
    tileTop: {
      position: "absolute",
      top: 8,
      left: 8,
      right: 8,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    liveBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: radii.pill,
      backgroundColor: "rgba(1,17,13,.9)",
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.danger,
    },
    liveText: { color: "#F4FFF9", fontSize: 9, fontWeight: "900" },
    tileTitle: {
      flex: 1,
      color: "#F4FFF9",
      fontSize: isTV ? 13 : 11,
      fontWeight: "900",
      textShadowColor: "#000",
      textShadowRadius: 5,
    },
    tileControls: {
      position: "absolute",
      left: 8,
      right: 8,
      bottom: 8,
      maxHeight: isTV ? 54 : 50,
    },
    tileControlsInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingRight: 20,
    },
  });
