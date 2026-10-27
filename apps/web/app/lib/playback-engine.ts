import type { StreamSource } from "@backinit/domain";
export type Transport = {
  destroy(): void;
  quality(index: number): void;
  live(): void;
};
export async function attachPlayback(
  video: HTMLVideoElement,
  source: StreamSource,
  callbacks: {
    error(): void;
    levels(levels: { label: string; index: number }[]): void;
    live(value: boolean): void;
    cancelled(): boolean;
  },
): Promise<Transport | undefined> {
  const live = () => {
    if (video.seekable.length)
      video.currentTime = Math.max(
        video.seekable.start(video.seekable.length - 1),
        video.seekable.end(video.seekable.length - 1) - 1,
      );
  };
  if (source.type === "dash") {
    const { MediaPlayer } = await import("dashjs");
    if (callbacks.cancelled()) return;
    const player = MediaPlayer().create();
    player.on(MediaPlayer.events.ERROR, callbacks.error);
    player.on(MediaPlayer.events.STREAM_INITIALIZED, () =>
      callbacks.live(player.isDynamic()),
    );
    player.initialize(video, source.url, false);
    return { destroy: () => player.reset(), quality: () => {}, live };
  }
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = source.url;
    return { destroy: () => {}, quality: () => {}, live };
  }
  const { default: Hls } = await import("hls.js");
  if (callbacks.cancelled()) return;
  if (!Hls.isSupported())
    throw new Error("This browser does not support this stream format.");
  const engine = new Hls({ maxBufferLength: 30 });
  engine.loadSource(source.url);
  engine.attachMedia(video);
  engine.on(Hls.Events.MANIFEST_PARSED, () =>
    callbacks.levels(
      engine.levels.map((l, index) => ({ label: `${l.height}p`, index })),
    ),
  );
  engine.on(Hls.Events.LEVEL_LOADED, (_, data) =>
    callbacks.live(data.details.live),
  );
  engine.on(Hls.Events.ERROR, (_, data) => {
    if (data.fatal) callbacks.error();
  });
  return {
    destroy: () => engine.destroy(),
    quality: (index) => {
      engine.currentLevel = index;
    },
    live: () => {
      if (engine.liveSyncPosition !== null)
        video.currentTime = engine.liveSyncPosition;
      else live();
    },
  };
}
