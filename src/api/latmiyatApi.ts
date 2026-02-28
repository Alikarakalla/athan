import type { LatmiyatTrack } from "../types/latmiyat";

const SOUNDCLOUD_DISCOVER_URL = "https://soundcloud.com/discover";
const SOUNDCLOUD_SEARCH_URL = "https://api-v2.soundcloud.com/search/tracks";

const LATMIYAT_KEYWORDS = [
  "لطمية",
  "لطميات",
  "نعي",
  "حسيني",
  "حسين",
  "عزاء",
  "محرم",
  "مأتم",
  "لطم",
  "latmiya",
  "latmiyat",
  "noha",
  "nauha",
  "hussain",
  "hussaini",
  "azadari",
  "majlis",
  "karbala",
];

const SHIA_DUA_KEYWORDS = [
  "دعاء",
  "دعا",
  "dua",
  "kumayl",
  "koumail",
  "komail",
  "كوميل",
  "كميل",
  "tawassul",
  "tawasul",
  "توسل",
  "التوسل",
  "nudba",
  "ندبة",
  "sabah",
  "الصباح",
  "الفرج",
  "عهد",
  "العهد",
  "عاشوراء",
  "ziyarat",
  "زيارة",
  "شيعي",
  "ahlulbayt",
  "imam",
];

const SHIA_ATHKAR_KEYWORDS = [
  "ذكر",
  "اذكار",
  "أذكار",
  "athkar",
  "azkar",
  "tasbih",
  "تسبيح",
  "استغفار",
  "استغفر",
  "istighfar",
  "salawat",
  "صلوات",
  "يا الله",
  "حوقلة",
  "حوقلة",
  "شيعي",
  "hussain",
  "imam ali",
];

const DEFAULT_LATMIYAT_TERMS = [
  "لطميات حسينية شيعية",
  "noha latmiyat shia",
  "nadeem sarwar noha",
  "basim karbalaei latmiyat",
] as const;

const DEFAULT_SHIA_DUA_TERMS = [
  "دعاء كميل شيعي",
  "دعاء التوسل شيعي",
  "Dua Kumayl Shia",
  "Dua Tawassul",
] as const;

const DEFAULT_SHIA_ATHKAR_TERMS = [
  "اذكار شيعية",
  "تسبيح استغفار شيعي",
  "Shia Athkar",
  "Shia Dhikr",
] as const;

interface SoundCloudTranscoding {
  url?: string;
  format?: {
    protocol?: string;
    mime_type?: string;
  };
}

interface SoundCloudTrackRaw {
  id?: number | string;
  urn?: string;
  title?: string;
  permalink_url?: string;
  artwork_url?: string | null;
  genre?: string | null;
  duration?: number;
  created_at?: string;
  description?: string;
  tag_list?: string;
  publisher_metadata?: {
    artist?: string | null;
    album_title?: string | null;
  } | null;
  user?: {
    username?: string;
    avatar_url?: string | null;
  } | null;
  media?: {
    transcodings?: SoundCloudTranscoding[];
  } | null;
}

interface SoundCloudSearchResponse {
  collection?: SoundCloudTrackRaw[];
}

interface SoundCloudTranscodingResolveResponse {
  url?: string;
}

let cachedClientId: string | null = null;
const resolvedPlaybackUrlCache = new Map<string, string>();

const readEnvClientId = () => {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.EXPO_PUBLIC_SOUNDCLOUD_CLIENT_ID?.trim() || null;
};

const extractScriptUrls = (html: string): string[] => {
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/g)].map((m) => m[1]);
  return scripts
    .map((src) => {
      if (src.startsWith("http")) return src;
      if (src.startsWith("//")) return `https:${src}`;
      return `https://soundcloud.com${src}`;
    })
    .filter((src) => src.includes("sndcdn.com/assets"));
};

const extractClientId = (scriptText: string): string | null => {
  const patterns = [
    /client_id:"([a-zA-Z0-9]{32})"/,
    /client_id\s*:\s*"([a-zA-Z0-9]{32})"/,
    /"client_id":"([a-zA-Z0-9]{32})"/,
  ];
  for (const pattern of patterns) {
    const match = scriptText.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
};

const getSoundCloudClientId = async (): Promise<string> => {
  const envClientId = readEnvClientId();
  if (envClientId) return envClientId;
  if (cachedClientId) return cachedClientId;

  const discoverResponse = await fetch(SOUNDCLOUD_DISCOVER_URL);
  if (!discoverResponse.ok) {
    throw new Error(`SoundCloud discover failed (${discoverResponse.status})`);
  }

  const discoverHtml = await discoverResponse.text();
  const scriptUrls = extractScriptUrls(discoverHtml).reverse();

  for (const scriptUrl of scriptUrls.slice(0, 12)) {
    try {
      const response = await fetch(scriptUrl);
      if (!response.ok) continue;
      const body = await response.text();
      const clientId = extractClientId(body);
      if (clientId) {
        cachedClientId = clientId;
        return clientId;
      }
    } catch {
      // Keep scanning other assets.
    }
  }

  throw new Error("Unable to resolve SoundCloud client ID");
};

const normalizeText = (value: string | null | undefined): string => (value ?? "").toLowerCase();

const trackMatchesKeywords = (track: SoundCloudTrackRaw, keywords: readonly string[]): boolean => {
  const text = [
    track.title,
    track.description,
    track.tag_list,
    track.genre,
    track.publisher_metadata?.artist,
    track.user?.username,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return keywords.some((keyword) => text.includes(keyword));
};

const pickPreferredTranscoding = (track: SoundCloudTrackRaw): SoundCloudTranscoding | null => {
  const transcodings = track.media?.transcodings ?? [];
  if (!transcodings.length) return null;

  const progressive = transcodings.find((t) => normalizeText(t.format?.protocol) === "progressive" && !!t.url);
  if (progressive) return progressive;

  const hls = transcodings.find((t) => normalizeText(t.format?.protocol) === "hls" && !!t.url);
  if (hls) return hls;

  return transcodings.find((t) => !!t.url) ?? null;
};

const mapTrack = (track: SoundCloudTrackRaw): LatmiyatTrack | null => {
  if (!track.title) return null;
  const stableId = track.urn || `${track.id ?? track.permalink_url ?? track.title}`;
  if (!stableId) return null;
  const transcoding = pickPreferredTranscoding(track);

  return {
    id: stableId,
    trackId: stableId,
    title: track.title,
    artistName: track.user?.username || track.publisher_metadata?.artist || "Unknown",
    albumName: track.publisher_metadata?.album_title || track.genre || "",
    artworkUrl: track.artwork_url || track.user?.avatar_url || null,
    previewUrl: transcoding?.url || null,
    trackUrl: track.permalink_url || null,
    releaseDate: track.created_at || null,
    durationMillis: track.duration ?? 0,
  };
};

const dedupeTracks = (tracks: LatmiyatTrack[]): LatmiyatTrack[] => {
  const seen = new Set<string>();
  const deduped: LatmiyatTrack[] = [];
  for (const track of tracks) {
    if (seen.has(track.trackId)) continue;
    seen.add(track.trackId);
    deduped.push(track);
  }
  return deduped;
};

const searchSoundCloud = async (
  query: string,
  clientId: string,
  keywords: readonly string[],
  limit = 50,
): Promise<LatmiyatTrack[]> => {
  const params = new URLSearchParams({
    q: query,
    client_id: clientId,
    limit: `${limit}`,
    linked_partitioning: "1",
  });
  const response = await fetch(`${SOUNDCLOUD_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`SoundCloud search failed (${response.status})`);
  }

  const payload = (await response.json()) as SoundCloudSearchResponse;
  const tracks = payload.collection ?? [];
  return tracks
    .filter((track) => trackMatchesKeywords(track, keywords))
    .map(mapTrack)
    .filter((item): item is LatmiyatTrack => !!item);
};

const fetchByTermsAndKeywords = async (
  terms: readonly string[],
  keywords: readonly string[],
): Promise<LatmiyatTrack[]> => {
  const clientId = await getSoundCloudClientId();
  const buckets = await Promise.all(terms.map((term) => searchSoundCloud(term, clientId, keywords, 40)));
  return dedupeTracks(buckets.flat()).sort((a, b) => {
    const dateA = a.releaseDate ? Date.parse(a.releaseDate) : 0;
    const dateB = b.releaseDate ? Date.parse(b.releaseDate) : 0;
    return dateB - dateA;
  });
};

export const fetchLatmiyatTracks = async (query?: string): Promise<LatmiyatTrack[]> => {
  const userQuery = query?.trim();

  const searchTerms = userQuery
    ? [`${userQuery} لطميات حسينية`, `${userQuery} noha latmiyat hussaini`]
    : [...DEFAULT_LATMIYAT_TERMS];
  return fetchByTermsAndKeywords(searchTerms, LATMIYAT_KEYWORDS);
};

export type ShiaSupplicationMode = "dua" | "athkar";

export const fetchShiaSupplicationTracks = async (
  mode: ShiaSupplicationMode,
  query?: string,
): Promise<LatmiyatTrack[]> => {
  const userQuery = query?.trim();

  if (mode === "dua") {
    const terms = userQuery
      ? [
          `${userQuery} دعاء شيعي`,
          `${userQuery} dua shia`,
          `${userQuery} kumayl tawassul`,
        ]
      : [...DEFAULT_SHIA_DUA_TERMS];
    return fetchByTermsAndKeywords(terms, SHIA_DUA_KEYWORDS);
  }

  const terms = userQuery
    ? [`${userQuery} اذكار شيعية`, `${userQuery} athkar shia`, `${userQuery} tasbih istighfar`]
    : [...DEFAULT_SHIA_ATHKAR_TERMS];
  return fetchByTermsAndKeywords(terms, SHIA_ATHKAR_KEYWORDS);
};

export const resolveLatmiyatPlaybackUrl = async (transcodingApiUrl: string): Promise<string> => {
  if (!transcodingApiUrl) {
    throw new Error("Missing SoundCloud transcoding URL");
  }

  const cached = resolvedPlaybackUrlCache.get(transcodingApiUrl);
  if (cached) return cached;

  const clientId = await getSoundCloudClientId();
  const separator = transcodingApiUrl.includes("?") ? "&" : "?";
  const response = await fetch(`${transcodingApiUrl}${separator}client_id=${clientId}`);

  if (!response.ok) {
    throw new Error(`SoundCloud stream resolve failed (${response.status})`);
  }

  const payload = (await response.json()) as SoundCloudTranscodingResolveResponse;
  if (!payload.url) {
    throw new Error("SoundCloud stream URL missing");
  }

  resolvedPlaybackUrlCache.set(transcodingApiUrl, payload.url);
  return payload.url;
};
