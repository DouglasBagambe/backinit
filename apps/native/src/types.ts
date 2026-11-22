export type Source = { id: string; label: string; url: string };

export type Broadcast = {
  id: string;
  title: string;
  category: string;
  competition: string;
  poster: string | null;
  start: number;
  end: number;
  channel: boolean;
  live?: boolean;
  sources: Source[];
  replay: boolean;
};

export type Video = {
  id: string;
  name: string;
  url: string;
  rightsOwner: string;
  catalog?: {
    sport: string;
    publisher: string;
    thumbnail: string | null;
    category: string;
  };
};

export type Catalogue = {
  broadcasts: Broadcast[];
  videos: Video[];
};

export type Section =
  "home" | "live" | "channels" | "multiview" | "replays" | "saved";
