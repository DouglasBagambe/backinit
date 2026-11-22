import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as NavigationBar from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useMemo, useState } from "react";
import {
  ImageBackground,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import {
  Brand,
  BrandMark,
  BroadcastCard,
  FocusButton,
  Player,
  ReplayCard,
} from "./src/components";
import { radii, type ThemeColors } from "./src/theme";
import { ThemeProvider, useTheme } from "./src/appearance";
import type { Broadcast, Section, Video } from "./src/types";
import { useCatalogue } from "./src/use-catalogue";
import { Settings } from "./src/settings";
import { Multiview } from "./src/multiview";

const isTV = Platform.isTV;
const sections: {
  key: Section;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: "home", label: "Discover", icon: "compass-outline" },
  { key: "live", label: "Live now", icon: "radio-outline" },
  { key: "channels", label: "Channels", icon: "tv-outline" },
  { key: "multiview", label: "Multiview", icon: "grid-outline" },
  { key: "replays", label: "Replays", icon: "play-circle-outline" },
  { key: "saved", label: "My sport", icon: "bookmark-outline" },
];

export default function App() {
  return (
    <ThemeProvider>
      <NativeApp />
    </ThemeProvider>
  );
}

function NativeApp() {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    catalogue,
    savedSet,
    loading,
    refreshing,
    error,
    refresh,
    toggleSaved,
  } = useCatalogue();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [section, setSection] = useState<Section>("home");
  const [query, setQuery] = useState("");
  const [channelSport, setChannelSport] = useState("All sports");
  const [player, setPlayer] = useState<{
    title: string;
    sources: { id: string; label: string; url: string }[];
  } | null>(null);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void SystemUI.setBackgroundColorAsync(colors.canvasDeep);
  }, [colors.canvasDeep]);

  const channels = useMemo(
    () => catalogue.broadcasts.filter((item) => item.channel),
    [catalogue.broadcasts],
  );
  const matches = useMemo(
    () => catalogue.broadcasts.filter((item) => !item.channel),
    [catalogue.broadcasts],
  );
  const live = useMemo(
    () =>
      matches.filter(
        (item) =>
          item.live || (item.start <= Date.now() && item.end >= Date.now()),
      ),
    [matches],
  );
  const filteredChannels = useMemo(() => {
    const term = query.trim().toLowerCase();
    const source =
      section === "saved"
        ? channels.filter((item) => savedSet.has(item.id))
        : channels;
    const sportSource =
      channelSport === "All sports"
        ? source
        : source.filter((item) => item.category === channelSport);
    return term
      ? sportSource.filter((item) =>
          `${item.title} ${item.category} ${item.competition}`
            .toLowerCase()
            .includes(term),
        )
      : sportSource;
  }, [channels, query, savedSet, section, channelSport]);
  const hero = live[0] || matches[0] || channels[0];

  const playBroadcast = (item: Broadcast) =>
    setPlayer({ title: item.title, sources: item.sources });
  const playVideo = (item: Video) =>
    setPlayer({
      title: item.name,
      sources: [
        {
          id: item.id,
          label:
            item.catalog?.publisher || item.rightsOwner || "Official source",
          url: item.url,
        },
      ],
    });

  return (
    <SafeAreaProvider>
      <SafeAreaView
        style={styles.safe}
        edges={["top", "bottom", "left", "right"]}
      >
        <StatusBar style={dark ? "light" : "dark"} />
        {!isTV && <NavigationBar.NavigationBar style="dark" />}
        {!player && (
          <>
            <Header
              section={section}
              setSection={setSection}
              onSettings={() => setSettingsOpen(true)}
            />
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              refreshControl={
                <RefreshControl
                  refreshing={refreshing && !loading}
                  onRefresh={refresh}
                  tintColor={colors.mint}
                  colors={[colors.mintStrong]}
                  progressBackgroundColor={colors.panel}
                />
              }
            >
              {loading ? (
                <Loading />
              ) : (
                <>
                  {error && <ErrorBanner message={error} onRetry={refresh} />}
                  {section === "home" && (
                    <Home
                      hero={hero}
                      channels={channels}
                      matches={matches}
                      videos={catalogue.videos}
                      savedSet={savedSet}
                      onPlay={playBroadcast}
                      onPlayVideo={playVideo}
                      onSave={toggleSaved}
                      onSection={setSection}
                    />
                  )}
                  {section === "live" && (
                    <Collection
                      eyebrow="NOW & NEXT"
                      title="Live & upcoming"
                      description="Every available event, ordered from live now into what starts next."
                      items={matches}
                      empty="No verified events are available right now. Pull down to refresh."
                      savedSet={savedSet}
                      onPlay={playBroadcast}
                      onSave={toggleSaved}
                    />
                  )}
                  {(section === "channels" || section === "saved") && (
                    <>
                      <PageIntro
                        eyebrow={
                          section === "saved" ? "YOUR LINEUP" : "ALWAYS ON"
                        }
                        title={
                          section === "saved" ? "Saved" : "Sports channels"
                        }
                        description={
                          section === "saved"
                            ? "The channels you saved, ready on every visit."
                            : `${channels.length} live sports networks across football, tennis, motorsport, combat sports and more.`
                        }
                      />
                      <SportFilters
                        items={channels}
                        selected={channelSport}
                        onChange={setChannelSport}
                      />
                      <Search value={query} onChange={setQuery} />
                      <Grid
                        items={filteredChannels}
                        savedSet={savedSet}
                        onPlay={playBroadcast}
                        onSave={toggleSaved}
                        empty={
                          section === "saved"
                            ? "Save channels and they will appear here."
                            : "No channels match that search."
                        }
                      />
                    </>
                  )}
                  {section === "replays" && (
                    <ReplayCollection
                      items={catalogue.videos}
                      onPlay={playVideo}
                    />
                  )}
                  {section === "multiview" && (
                    <Multiview
                      broadcasts={[
                        ...live,
                        ...matches.filter((item) => !live.includes(item)),
                        ...channels,
                      ]}
                    />
                  )}
                </>
              )}
            </ScrollView>
            {!isTV && <MobileNav section={section} onChange={setSection} />}
          </>
        )}
        <Settings
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
        <Player
          title={player?.title || ""}
          sources={player?.sources || []}
          visible={Boolean(player)}
          onClose={() => setPlayer(null)}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Header({
  section,
  setSection,
  onSettings,
}: {
  section: Section;
  setSection: (section: Section) => void;
  onSettings: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <Brand compact={isTV} />
      {isTV && (
        <View style={styles.tvNav}>
          {sections.map((item) => (
            <FocusButton
              key={item.key}
              icon={item.icon}
              selected={section === item.key}
              hasTVPreferredFocus={section === item.key}
              onPress={() => setSection(item.key)}
              style={styles.tvNavButton}
            >
              {item.label
                .replace("Discover", "Home")
                .replace("Live now", "Live")
                .replace("My sport", "Saved")}
            </FocusButton>
          ))}
        </View>
      )}
      <FocusButton
        icon="person-outline"
        onPress={onSettings}
        accessibilityLabel="Profile and appearance settings"
        style={{ marginLeft: "auto", paddingHorizontal: 12 }}
      >
        Settings
      </FocusButton>
    </View>
  );
}

function MobileNav({
  section,
  onChange,
}: {
  section: Section;
  onChange: (section: Section) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.mobileNav}>
      {sections.map((item) => {
        const active = section === item.key;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            style={styles.mobileNavItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={
                active
                  ? (item.icon.replace(
                      "-outline",
                      "",
                    ) as keyof typeof Ionicons.glyphMap)
                  : item.icon
              }
              size={22}
              color={active ? colors.mint : colors.muted}
            />
            <Text
              style={[
                styles.mobileNavText,
                active && styles.mobileNavTextActive,
              ]}
            >
              {item.label
                .replace("Discover", "Home")
                .replace("Live now", "Live")
                .replace("My sport", "Saved")}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Home({
  hero,
  channels,
  matches,
  videos,
  savedSet,
  onPlay,
  onPlayVideo,
  onSave,
  onSection,
}: {
  hero?: Broadcast;
  channels: Broadcast[];
  matches: Broadcast[];
  videos: Video[];
  savedSet: Set<string>;
  onPlay: (item: Broadcast) => void;
  onPlayVideo: (item: Video) => void;
  onSave: (id: string) => void;
  onSection: (section: Section) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sports = new Set(channels.map((item) => item.category)).size;
  return (
    <>
      {hero && (
        <Hero
          item={hero}
          onPlay={onPlay}
          onSave={onSave}
          saved={savedSet.has(hero.id)}
        />
      )}
      <View style={styles.catalogueSummary}>
        <Text style={styles.catalogueSummaryLead}>
          Everything playing now and next
        </Text>
        <Text style={styles.catalogueSummaryMeta}>
          {matches.length} events · {channels.length} live channels · {sports}{" "}
          sports
        </Text>
      </View>
      <Rail
        title="Live & upcoming"
        action="Open live"
        onAction={() => onSection("live")}
      >
        {matches.slice(0, 16).map((item) => (
          <BroadcastCard
            key={item.id}
            item={item}
            saved={savedSet.has(item.id)}
            onPlay={onPlay}
            onSave={onSave}
          />
        ))}
      </Rail>
      <Rail
        title="Live sports channels"
        action="See all"
        onAction={() => onSection("channels")}
      >
        {channels.slice(0, 14).map((item) => (
          <BroadcastCard
            key={item.id}
            item={item}
            saved={savedSet.has(item.id)}
            onPlay={onPlay}
            onSave={onSave}
          />
        ))}
      </Rail>
      {videos.length > 0 && (
        <Rail
          title="Full matches & highlights"
          action="Browse replays"
          onAction={() => onSection("replays")}
        >
          {videos.slice(0, 14).map((item) => (
            <ReplayCard key={item.id} item={item} onPlay={onPlayVideo} />
          ))}
        </Rail>
      )}
    </>
  );
}

function Hero({
  item,
  onPlay,
  onSave,
  saved,
}: {
  item: Broadcast;
  onPlay: (item: Broadcast) => void;
  onSave: (id: string) => void;
  saved: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [posterFailed, setPosterFailed] = useState(false);
  return (
    <ImageBackground
      source={item.poster && !posterFailed ? { uri: item.poster } : undefined}
      onError={() => setPosterFailed(true)}
      style={styles.hero}
      imageStyle={styles.heroImage}
    >
      {(!item.poster || posterFailed) && (
        <View style={styles.heroFallback}>
          <BrandMark size={150} />
        </View>
      )}
      <LinearGradient
        colors={["rgba(1,17,13,.08)", "rgba(1,17,13,.96)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroCopy}>
        <View style={styles.heroLive}>
          <View style={styles.heroLiveDot} />
          <Text style={styles.heroLiveText}>
            {item.channel
              ? "LIVE 24/7"
              : item.live ||
                  (item.start <= Date.now() && item.end >= Date.now())
                ? "LIVE NOW"
                : "UPCOMING"}
          </Text>
        </View>
        <Text style={styles.heroEyebrow}>
          {item.category} · {item.competition}
        </Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.heroDescription}>
          {item.sources.length} stream option
          {item.sources.length === 1 ? "" : "s"}. Switch sources without leaving
          the player.
        </Text>
        <View style={styles.heroActions}>
          <FocusButton icon="play" selected onPress={() => onPlay(item)}>
            Watch now
          </FocusButton>
          <FocusButton
            icon={saved ? "bookmark" : "bookmark-outline"}
            onPress={() => onSave(item.id)}
          >
            {saved ? "Saved" : "Save"}
          </FocusButton>
        </View>
      </View>
    </ImageBackground>
  );
}

function Rail({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.rail}>
      <View style={styles.railHeader}>
        <Text style={styles.railTitle}>{title}</Text>
        {action && (
          <Pressable onPress={onAction}>
            <Text style={styles.railAction}>{action} →</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.railContent}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function Collection({
  eyebrow,
  title,
  description,
  items,
  empty,
  savedSet,
  onPlay,
  onSave,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: Broadcast[];
  empty: string;
  savedSet: Set<string>;
  onPlay: (item: Broadcast) => void;
  onSave: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [sport, setSport] = useState("All sports");
  const [term, setTerm] = useState("");
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (sport === "All sports" || item.category === sport) &&
          `${item.title} ${item.competition}`
            .toLowerCase()
            .includes(term.toLowerCase()),
      ),
    [items, sport, term],
  );
  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} description={description} />
      <SportFilters items={items} selected={sport} onChange={setSport} />
      <Search
        value={term}
        onChange={setTerm}
        placeholder="Search matches, teams or competitions…"
      />
      <Grid
        items={filtered}
        savedSet={savedSet}
        onPlay={onPlay}
        onSave={onSave}
        empty={empty}
      />
    </>
  );
}

function ReplayCollection({
  items,
  onPlay,
}: {
  items: Video[];
  onPlay: (item: Video) => void;
}) {
  const { width } = useWindowDimensions();
  const columns = isTV ? (width >= 900 ? 4 : 3) : width >= 700 ? 2 : 1;
  const cardWidth = (width - (isTV ? 56 : 36) - 16 * (columns - 1)) / columns;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const batch = isTV ? 36 : 18;
  const [limit, setLimit] = useState(batch);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? items.filter((item) =>
          `${item.name} ${item.catalog?.sport} ${item.catalog?.publisher}`
            .toLowerCase()
            .includes(term),
        )
      : items;
  }, [items, query]);
  useEffect(() => setLimit(batch), [query, items.length, batch]);
  const visible = filtered.slice(0, limit);
  return (
    <>
      <PageIntro
        eyebrow="ON YOUR TIME"
        title="Replays & highlights"
        description={`${items.length} official full matches, fights, races and highlights.`}
      />
      <Search
        value={query}
        onChange={setQuery}
        placeholder="Search players, teams, events…"
      />
      {filtered.length > 0 ? (
        <View style={styles.grid}>
          {visible.map((item) => (
            <ReplayCard
              key={item.id}
              item={item}
              onPlay={onPlay}
              cardWidth={cardWidth}
            />
          ))}
          {visible.length < filtered.length && (
            <FocusButton onPress={() => setLimit((value) => value + batch)}>
              Show more · {filtered.length - visible.length} remaining
            </FocusButton>
          )}
        </View>
      ) : (
        <Empty
          message={
            items.length
              ? "No replays match that search."
              : "The replay service is temporarily unavailable. Live events and channels are still ready to watch."
          }
        />
      )}
    </>
  );
}

function Grid({
  items,
  savedSet,
  onPlay,
  onSave,
  empty,
}: {
  items: Broadcast[];
  savedSet: Set<string>;
  onPlay: (item: Broadcast) => void;
  onSave: (id: string) => void;
  empty: string;
}) {
  const { width } = useWindowDimensions();
  const columns = isTV ? (width >= 900 ? 4 : 3) : width >= 700 ? 2 : 1;
  const cardWidth = (width - (isTV ? 56 : 36) - 16 * (columns - 1)) / columns;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const batch = isTV ? 48 : 24;
  const [limit, setLimit] = useState(batch);
  useEffect(() => setLimit(batch), [items, batch]);
  if (!items.length) return <Empty message={empty} />;
  const visible = items.slice(0, limit);
  return (
    <View style={styles.grid}>
      {visible.map((item) => (
        <BroadcastCard
          key={item.id}
          item={item}
          saved={savedSet.has(item.id)}
          onPlay={onPlay}
          onSave={onSave}
          cardWidth={cardWidth}
        />
      ))}
      {visible.length < items.length && (
        <FocusButton onPress={() => setLimit((value) => value + batch)}>
          Show more · {items.length - visible.length} remaining
        </FocusButton>
      )}
    </View>
  );
}

function PageIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.pageIntro}>
      {!isTV && <Text style={styles.eyebrow}>{eyebrow}</Text>}
      <Text style={styles.pageTitle}>{title}</Text>
      {!isTV && <Text style={styles.pageDescription}>{description}</Text>}
    </View>
  );
}

function SportFilters({
  items,
  selected,
  onChange,
}: {
  items: Broadcast[];
  selected: string;
  onChange: (value: string) => void;
}) {
  const options = [
    "All sports",
    ...Array.from(new Set(items.map((item) => item.category))).sort(),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{
        paddingHorizontal: isTV ? 28 : 18,
        paddingVertical: 6,
        paddingBottom: 16,
        gap: 8,
      }}
    >
      {options.map((sport) => (
        <FocusButton
          key={sport}
          selected={selected === sport}
          onPress={() => onChange(sport)}
        >
          {sport}
        </FocusButton>
      ))}
    </ScrollView>
  );
}

function Search({
  value,
  onChange,
  placeholder = "Search channels and sports…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={20} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={styles.searchInput}
      />
    </View>
  );
}

function Empty({ message }: { message: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.empty}>
      <Ionicons name="sparkles-outline" size={38} color={colors.mint} />
      <Text style={styles.emptyTitle}>Nothing here yet</Text>
      <Text style={styles.emptyCopy}>{message}</Text>
    </View>
  );
}

function Loading() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.loading}>
      <View style={styles.loadingMark}>
        <BrandMark size={46} />
      </View>
      <Text style={styles.loadingTitle}>Bringing your sport together</Text>
      <Text style={styles.emptyCopy}>
        Loading live channels, matches and replays…
      </Text>
    </View>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.error}>
      <Ionicons name="cloud-offline-outline" size={22} color={colors.gold} />
      <Text style={styles.errorText}>{message}</Text>
      <FocusButton onPress={onRetry}>Try again</FocusButton>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.canvasDeep },
    header: {
      minHeight: isTV ? 72 : 72,
      paddingHorizontal: isTV ? 24 : 18,
      flexDirection: "row",
      alignItems: "center",
      gap: isTV ? 12 : 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      backgroundColor: colors.canvas,
      zIndex: 20,
      elevation: 3,
    },
    tvNav: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 8 },
    tvNavButton: { minHeight: 44, paddingHorizontal: 12 },
    profile: {
      width: isTV ? 44 : 42,
      height: isTV ? 44 : 42,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: "auto",
    },
    scroll: { flex: 1 },
    content: { paddingBottom: isTV ? 70 : 28 },
    hero: {
      minHeight: isTV ? 315 : 410,
      justifyContent: "flex-end",
      backgroundColor: colors.panel,
    },
    heroImage: { resizeMode: "cover", opacity: 0.74 },
    heroFallback: {
      position: "absolute",
      inset: 0,
      alignItems: "center",
      justifyContent: "center",
      opacity: 0.18,
    },
    heroCopy: {
      maxWidth: isTV ? 720 : 620,
      paddingHorizontal: isTV ? 34 : 22,
      paddingBottom: isTV ? 24 : 30,
      gap: isTV ? 10 : 10,
    },
    heroLive: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "rgba(1,17,13,.82)",
      borderRadius: radii.pill,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    heroLiveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.danger,
    },
    heroLiveText: {
      color: "#F4FFF9",
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
    },
    heroEyebrow: {
      color: "#62E2B2",
      fontSize: isTV ? 14 : 13,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 1.5,
    },
    heroTitle: {
      color: "#F4FFF9",
      fontSize: isTV ? 38 : 36,
      lineHeight: isTV ? 42 : 40,
      fontWeight: "900",
      letterSpacing: -1.8,
    },
    heroDescription: {
      color: "#BFD5CC",
      fontSize: isTV ? 16 : 15,
      lineHeight: isTV ? 23 : 22,
      maxWidth: 650,
    },
    heroActions: { flexDirection: "row", gap: 12, marginTop: 7 },
    catalogueSummary: {
      paddingHorizontal: isTV ? 28 : 18,
      paddingTop: isTV ? 22 : 20,
      gap: 4,
    },
    catalogueSummaryLead: {
      color: colors.ink,
      fontSize: isTV ? 22 : 18,
      fontWeight: "900",
    },
    catalogueSummaryMeta: {
      color: colors.muted,
      fontSize: isTV ? 15 : 13,
      fontWeight: "700",
    },
    rail: { marginTop: isTV ? 22 : 26 },
    railHeader: {
      paddingHorizontal: isTV ? 28 : 18,
      marginBottom: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    railTitle: {
      color: colors.ink,
      fontSize: isTV ? 24 : 21,
      fontWeight: "900",
      letterSpacing: -0.6,
    },
    railAction: {
      color: colors.mint,
      fontSize: isTV ? 17 : 14,
      fontWeight: "800",
    },
    railContent: { paddingHorizontal: isTV ? 28 : 18, paddingBottom: 18 },
    pageIntro: {
      paddingHorizontal: isTV ? 28 : 18,
      paddingTop: isTV ? 22 : 24,
      paddingBottom: isTV ? 16 : 18,
      maxWidth: isTV ? 980 : undefined,
    },
    eyebrow: {
      color: colors.mint,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 1.8,
    },
    pageTitle: {
      color: colors.ink,
      fontSize: isTV ? 30 : 30,
      fontWeight: "900",
      letterSpacing: -1.5,
      marginTop: 7,
    },
    pageDescription: {
      color: colors.muted,
      fontSize: isTV ? 16 : 15,
      lineHeight: isTV ? 23 : 23,
      marginTop: 8,
    },
    search: {
      marginHorizontal: isTV ? 40 : 20,
      minHeight: isTV ? 50 : 52,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      gap: 10,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      color: colors.ink,
      fontSize: isTV ? 15 : 15,
      fontWeight: "600",
    },
    grid: {
      paddingHorizontal: isTV ? 28 : 18,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
      paddingBottom: 34,
    },
    mobileNav: {
      height: 68,
      marginHorizontal: 12,
      marginTop: 6,
      marginBottom: 8,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvas,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
      shadowColor: "#000",
      shadowOpacity: 0.4,
      shadowRadius: 16,
      elevation: 18,
    },
    mobileNavItem: {
      flex: 1,
      height: 62,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    mobileNavText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
    mobileNavTextActive: { color: colors.mint },
    empty: {
      margin: isTV ? 58 : 20,
      minHeight: 230,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      alignItems: "center",
      justifyContent: "center",
      padding: 30,
      gap: 9,
    },
    emptyTitle: { color: colors.ink, fontSize: 21, fontWeight: "900" },
    emptyCopy: {
      color: colors.muted,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 21,
    },
    loading: {
      minHeight: 480,
      alignItems: "center",
      justifyContent: "center",
      gap: 13,
      paddingHorizontal: 28,
    },
    loadingMark: {
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 6,
    },
    loadingTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
    error: {
      marginHorizontal: isTV ? 58 : 20,
      marginTop: 20,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: "#7E6431",
      backgroundColor: "#332A16",
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    errorText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" },
  });
