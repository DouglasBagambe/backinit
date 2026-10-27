type Player = { destroy(): void };
type YouTube = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      host: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady: () => void;
        onError: (event: { data: number }) => void;
        onStateChange: (event: { data: number }) => void;
      };
    },
  ) => Player;
};
type VideoWindow = Window & {
  YT?: YouTube;
  onYouTubeIframeAPIReady?: () => void;
};
let loading: Promise<YouTube> | undefined;
export function youtube() {
  const target = window as VideoWindow;
  if (target.YT?.Player) return Promise.resolve(target.YT);
  if (loading) return loading;
  loading = new Promise<YouTube>((resolve, reject) => {
    const fail = () => {
      loading = undefined;
      reject(
        new Error(
          "The official player could not load. Check your connection and retry.",
        ),
      );
    };
    const timer = setTimeout(fail, 15000);
    const previous = target.onYouTubeIframeAPIReady;
    target.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      previous?.();
      target.YT ? resolve(target.YT) : fail();
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      fail();
    };
    document.head.append(script);
  });
  return loading;
}
