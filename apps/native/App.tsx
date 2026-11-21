import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Brand, BroadcastCard, FocusButton, Player, ReplayCard } from "./src/components";
import { colors, radii } from "./src/theme";
import type { Broadcast, Section, Video } from "./src/types";
import { useCatalogue } from "./src/use-catalogue";

const isTV = Platform.isTV;
const sections: { key: Section; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "home", label: "Discover", icon: "compass-outline" },
  { key: "live", label: "Live now", icon: "radio-outline" },
  { key: "channels", label: "Channels", icon: "tv-outline" },
  { key: "replays", label: "Replays", icon: "play-circle-outline" },
  { key: "saved", label: "My sport", icon: "bookmark-outline" },
];

export default function App() {
  const { catalogue, savedSet, loading, refreshing, error, refresh, toggleSaved } = useCatalogue();
  const [section, setSection] = useState<Section>("home");
  const [query, setQuery] = useState("");
  const [player, setPlayer] = useState<{ title: string; sources: { id: string; label: string; url: string }[] } | null>(null);

  const channels = useMemo(() => catalogue.broadcasts.filter((item) => item.channel), [catalogue.broadcasts]);
  const matches = useMemo(() => catalogue.broadcasts.filter((item) => !item.channel), [catalogue.broadcasts]);
  const live = useMemo(() => matches.filter((item) => item.live || (item.start <= Date.now() && item.end >= Date.now())), [matches]);
  const filteredChannels = useMemo(() => {
    const term = query.trim().toLowerCase();
    const source = section === "saved" ? channels.filter((item) => savedSet.has(item.id)) : channels;
    return term ? source.filter((item) => `${item.title} ${item.category} ${item.competition}`.toLowerCase().includes(term)) : source;
  }, [channels, query, savedSet, section]);
  const hero = live[0] || matches[0] || channels[0];

  const playBroadcast = (item: Broadcast) => setPlayer({ title: item.title, sources: item.sources });
  const playVideo = (item: Video) => setPlayer({
    title: item.name,
    sources: [{ id: item.id, label: item.catalog?.publisher || item.rightsOwner || "Official source", url: item.url }],
  });

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
        <StatusBar style="light" />
        <Header section={section} setSection={setSection} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.mint} colors={[colors.mintStrong]} />}
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
                  eyebrow="HAPPENING NOW"
                  title="Live sport"
                  description="Matches and broadcasts currently in progress."
                  items={live}
                  empty="There are no verified live matches at this moment. Pull down to refresh."
                  savedSet={savedSet}
                  onPlay={playBroadcast}
                  onSave={toggleSaved}
                />
              )}
              {(section === "channels" || section === "saved") && (
                <>
                  <PageIntro
                    eyebrow={section === "saved" ? "YOUR LINEUP" : "ALWAYS ON"}
                    title={section === "saved" ? "My sport" : "Sports channels"}
                    description={section === "saved" ? "The channels you saved, ready on every visit." : `${channels.length} live sports networks across football, tennis, motorsport, combat sports and more.`}
                  />
                  <Search value={query} onChange={setQuery} />
                  <Grid
                    items={filteredChannels}
                    savedSet={savedSet}
                    onPlay={playBroadcast}
                    onSave={toggleSaved}
                    empty={section === "saved" ? "Save channels and they will appear here." : "No channels match that search."}
                  />
                </>
              )}
              {section === "replays" && (
                <ReplayCollection items={catalogue.videos} onPlay={playVideo} />
              )}
            </>
          )}
        </ScrollView>
        {!isTV && <MobileNav section={section} onChange={setSection} />}
        <Player title={player?.title || ""} sources={player?.sources || []} visible={Boolean(player)} onClose={() => setPlayer(null)} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Header({ section, setSection }: { section: Section; setSection: (section: Section) => void }) {
  return (
    <View style={styles.header}>
      <Brand />
      {isTV && (
        <View style={styles.tvNav}>
          {sections.map((item) => (
            <FocusButton key={item.key} icon={item.icon} selected={section === item.key} onPress={() => setSection(item.key)}>
              {item.label}
            </FocusButton>
          ))}
        </View>
      )}
      <View style={styles.profile}><Ionicons name="person-outline" color={colors.ink} size={isTV ? 25 : 21} /></View>
    </View>
  );
}

function MobileNav({ section, onChange }: { section: Section; onChange: (section: Section) => void }) {
  return (
    <View style={styles.mobileNav}>
      {sections.map((item) => {
        const active = section === item.key;
        return (
          <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.mobileNavItem} accessibilityRole="tab" accessibilityState={{ selected: active }}>
            <Ionicons name={active ? (item.icon.replace("-outline", "") as keyof typeof Ionicons.glyphMap) : item.icon} size={22} color={active ? colors.mint : colors.muted} />
            <Text style={[styles.mobileNavText, active && styles.mobileNavTextActive]}>{item.label.replace("Discover", "Home").replace("Live now", "Live").replace("My sport", "Saved")}</Text>
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
  const sports = new Set(channels.map((item) => item.category)).size;
  return (
    <>
      {hero && <Hero item={hero} onPlay={onPlay} onSave={onSave} saved={savedSet.has(hero.id)} />}
      <View style={styles.statsRow}>
        <Stat value={String(channels.length)} label="live channels" />
        <Stat value={String(matches.length)} label="matches" />
        <Stat value={String(sports)} label="sports" />
      </View>
      <Rail title="Live sports channels" action="See all" onAction={() => onSection("channels")}>
        {channels.slice(0, 14).map((item) => <BroadcastCard key={item.id} item={item} saved={savedSet.has(item.id)} onPlay={onPlay} onSave={onSave} />)}
      </Rail>
      <Rail title="Full matches & highlights" action="Browse replays" onAction={() => onSection("replays")}>
        {videos.slice(0, 14).map((item) => <ReplayCard key={item.id} item={item} onPlay={onPlayVideo} />)}
      </Rail>
      <Rail title="More live choices">
        {matches.slice(0, 14).map((item) => <BroadcastCard key={item.id} item={item} saved={savedSet.has(item.id)} onPlay={onPlay} onSave={onSave} />)}
      </Rail>
    </>
  );
}

function Hero({ item, onPlay, onSave, saved }: { item: Broadcast; onPlay: (item: Broadcast) => void; onSave: (id: string) => void; saved: boolean }) {
  return (
    <ImageBackground source={item.poster ? { uri: item.poster } : undefined} style={styles.hero} imageStyle={styles.heroImage}>
      <LinearGradient colors={["rgba(1,17,13,.08)", "rgba(1,17,13,.96)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.heroCopy}>
        <View style={styles.heroLive}><View style={styles.heroLiveDot} /><Text style={styles.heroLiveText}>{item.channel ? "LIVE 24/7" : "LIVE NOW"}</Text></View>
        <Text style={styles.heroEyebrow}>{item.category} · {item.competition}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.heroDescription}>{item.sources.length} verified stream option{item.sources.length === 1 ? "" : "s"}. Switch sources without leaving the player.</Text>
        <View style={styles.heroActions}>
          <FocusButton icon="play" selected onPress={() => onPlay(item)}>Watch now</FocusButton>
          <FocusButton icon={saved ? "bookmark" : "bookmark-outline"} onPress={() => onSave(item.id)}>{saved ? "Saved" : "Save"}</FocusButton>
        </View>
      </View>
    </ImageBackground>
  );
}

function Rail({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return (
    <View style={styles.rail}>
      <View style={styles.railHeader}>
        <Text style={styles.railTitle}>{title}</Text>
        {action && <Pressable onPress={onAction}><Text style={styles.railAction}>{action}  →</Text></Pressable>}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.railContent}>{children}</ScrollView>
    </View>
  );
}

function Collection({ eyebrow, title, description, items, empty, savedSet, onPlay, onSave }: { eyebrow: string; title: string; description: string; items: Broadcast[]; empty: string; savedSet: Set<string>; onPlay: (item: Broadcast) => void; onSave: (id: string) => void }) {
  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} description={description} />
      <Grid items={items} savedSet={savedSet} onPlay={onPlay} onSave={onSave} empty={empty} />
    </>
  );
}

function ReplayCollection({ items, onPlay }: { items: Video[]; onPlay: (item: Video) => void }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? items.filter((item) => `${item.name} ${item.catalog?.sport} ${item.catalog?.publisher}`.toLowerCase().includes(term)) : items;
  }, [items, query]);
  return (
    <>
      <PageIntro eyebrow="ON YOUR TIME" title="Replays & highlights" description={`${items.length} official full matches, fights, races and highlights.`} />
      <Search value={query} onChange={setQuery} placeholder="Search players, teams, events…" />
      <View style={styles.grid}>
        {filtered.map((item) => <ReplayCard key={item.id} item={item} onPlay={onPlay} />)}
      </View>
    </>
  );
}

function Grid({ items, savedSet, onPlay, onSave, empty }: { items: Broadcast[]; savedSet: Set<string>; onPlay: (item: Broadcast) => void; onSave: (id: string) => void; empty: string }) {
  if (!items.length) return <Empty message={empty} />;
  return (
    <View style={styles.grid}>
      {items.map((item) => <BroadcastCard key={item.id} item={item} saved={savedSet.has(item.id)} onPlay={onPlay} onSave={onSave} />)}
    </View>
  );
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <View style={styles.pageIntro}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageDescription}>{description}</Text></View>;
}

function Search({ value, onChange, placeholder = "Search channels and sports…" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <View style={styles.search}><Ionicons name="search" size={20} color={colors.muted} /><TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} style={styles.searchInput} /></View>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Empty({ message }: { message: string }) {
  return <View style={styles.empty}><Ionicons name="sparkles-outline" size={38} color={colors.mint} /><Text style={styles.emptyTitle}>Nothing here yet</Text><Text style={styles.emptyCopy}>{message}</Text></View>;
}

function Loading() {
  return <View style={styles.loading}><ActivityIndicator size="large" color={colors.mint} /><Text style={styles.loadingTitle}>Bringing your sport together</Text><Text style={styles.emptyCopy}>Live channels, matches and replays are loading.</Text></View>;
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <View style={styles.error}><Ionicons name="cloud-offline-outline" size={22} color={colors.gold} /><Text style={styles.errorText}>{message}</Text><FocusButton onPress={onRetry}>Try again</FocusButton></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvasDeep },
  header: { minHeight: isTV ? 92 : 72, paddingHorizontal: isTV ? 48 : 18, flexDirection: "row", alignItems: "center", gap: 24, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: "rgba(3,27,21,.98)", zIndex: 5 },
  tvNav: { flex: 1, flexDirection: "row", justifyContent: "center", gap: 12 },
  profile: { width: isTV ? 50 : 42, height: isTV ? 50 : 42, borderRadius: 30, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", marginLeft: "auto" },
  scroll: { flex: 1 },
  content: { paddingBottom: isTV ? 70 : 110 },
  hero: { minHeight: isTV ? 560 : 510, justifyContent: "flex-end", backgroundColor: colors.panel },
  heroImage: { resizeMode: "cover", opacity: 0.74 },
  heroCopy: { maxWidth: isTV ? 760 : 620, paddingHorizontal: isTV ? 68 : 22, paddingBottom: isTV ? 62 : 34, gap: isTV ? 14 : 10 },
  heroLive: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(1,17,13,.82)", borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 7 },
  heroLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  heroLiveText: { color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  heroEyebrow: { color: colors.mint, fontSize: isTV ? 17 : 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.5 },
  heroTitle: { color: colors.ink, fontSize: isTV ? 58 : 38, lineHeight: isTV ? 64 : 42, fontWeight: "900", letterSpacing: -1.8 },
  heroDescription: { color: colors.muted, fontSize: isTV ? 19 : 15, lineHeight: isTV ? 28 : 22, maxWidth: 650 },
  heroActions: { flexDirection: "row", gap: 12, marginTop: 7 },
  statsRow: { flexDirection: "row", gap: isTV ? 18 : 10, paddingHorizontal: isTV ? 48 : 18, marginTop: isTV ? -24 : 16, zIndex: 2 },
  stat: { flex: 1, maxWidth: 250, padding: isTV ? 22 : 16, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  statValue: { color: colors.lime, fontSize: isTV ? 30 : 23, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: isTV ? 14 : 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  rail: { marginTop: isTV ? 48 : 32 },
  railHeader: { paddingHorizontal: isTV ? 48 : 18, marginBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  railTitle: { color: colors.ink, fontSize: isTV ? 28 : 21, fontWeight: "900", letterSpacing: -0.6 },
  railAction: { color: colors.mint, fontSize: isTV ? 17 : 14, fontWeight: "800" },
  railContent: { paddingHorizontal: isTV ? 48 : 18, paddingBottom: 18 },
  pageIntro: { paddingHorizontal: isTV ? 58 : 20, paddingTop: isTV ? 58 : 34, paddingBottom: isTV ? 32 : 24, maxWidth: isTV ? 980 : undefined },
  eyebrow: { color: colors.mint, fontSize: 12, fontWeight: "900", letterSpacing: 1.8 },
  pageTitle: { color: colors.ink, fontSize: isTV ? 48 : 34, fontWeight: "900", letterSpacing: -1.5, marginTop: 7 },
  pageDescription: { color: colors.muted, fontSize: isTV ? 18 : 15, lineHeight: isTV ? 27 : 23, marginTop: 8 },
  search: { marginHorizontal: isTV ? 58 : 20, minHeight: isTV ? 58 : 52, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 10, marginBottom: 26 },
  searchInput: { flex: 1, color: colors.ink, fontSize: isTV ? 17 : 15, fontWeight: "600" },
  grid: { paddingHorizontal: isTV ? 58 : 20, flexDirection: "row", flexWrap: "wrap", gap: isTV ? 24 : 16, paddingBottom: 34 },
  mobileNav: { position: "absolute", left: 12, right: 12, bottom: 10, height: 72, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(3,27,21,.98)", flexDirection: "row", alignItems: "center", justifyContent: "space-around", shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 16, elevation: 18 },
  mobileNavItem: { flex: 1, height: 62, alignItems: "center", justifyContent: "center", gap: 3 },
  mobileNavText: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  mobileNavTextActive: { color: colors.mint },
  empty: { margin: isTV ? 58 : 20, minHeight: 230, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", padding: 30, gap: 9 },
  emptyTitle: { color: colors.ink, fontSize: 21, fontWeight: "900" },
  emptyCopy: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 21 },
  loading: { minHeight: 560, alignItems: "center", justifyContent: "center", gap: 13 },
  loadingTitle: { color: colors.ink, fontSize: 22, fontWeight: "900" },
  error: { marginHorizontal: isTV ? 58 : 20, marginTop: 20, borderRadius: radii.md, borderWidth: 1, borderColor: "#7E6431", backgroundColor: "#332A16", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  errorText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" },
});
