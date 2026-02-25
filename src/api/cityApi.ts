import type { CitySearchResult } from "../types/location";

type GeoNamesOdsResponse = {
  total_count?: number;
  results?: Array<{
    geoname_id?: string | number;
    name: string;
    cou_name_en?: string;
    admin1_code?: string;
    label_en?: string;
    population?: number;
    timezone?: string;
    coordinates?: {
      lat: number;
      lon: number;
    };
  }>;
};

const ODS_BASE =
  "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/geonames-all-cities-with-a-population-1000/records";

const mapOdsCity = (item: NonNullable<GeoNamesOdsResponse["results"]>[number]): CitySearchResult | null => {
  if (!item.coordinates) return null;
  return {
    id: String(item.geoname_id ?? `${item.name}-${item.coordinates.lat}-${item.coordinates.lon}`),
    name: item.name,
    country: item.cou_name_en ?? item.label_en ?? "Unknown",
    region: item.admin1_code ?? undefined,
    latitude: item.coordinates.lat,
    longitude: item.coordinates.lon,
    timezone: item.timezone,
  };
};

export interface CitySearchPage {
  results: CitySearchResult[];
  totalCount: number;
}

export const searchCitiesWorldwide = async (
  query: string,
  options?: { limit?: number; offset?: number },
): Promise<CitySearchPage> => {
  const q = query.trim();
  if (q.length < 2) return { results: [], totalCount: 0 };
  const limit = options?.limit ?? 40;
  const offset = options?.offset ?? 0;

  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    where: `search(name, "${q.replace(/"/g, '\\"')}") OR search(ascii_name, "${q.replace(/"/g, '\\"')}")`,
    order_by: "population desc",
  });
  const response = await fetch(`${ODS_BASE}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`City search failed (${response.status})`);
  }
  const json = (await response.json()) as GeoNamesOdsResponse;
  return {
    results: (json.results ?? []).map(mapOdsCity).filter((x): x is CitySearchResult => !!x),
    totalCount: json.total_count ?? 0,
  };
};

export const fetchInitialCitySuggestions = async (
  seed?: string,
  options?: { limit?: number; offset?: number },
): Promise<CitySearchPage> => {
  const q = seed?.trim();
  if (q && q.length >= 2) return searchCitiesWorldwide(q, options);
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  // Worldwide initial list (largest cities) so the picker is never nearly empty.
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    order_by: "population desc",
  });
  const response = await fetch(`${ODS_BASE}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Initial city list failed (${response.status})`);
  }
  const json = (await response.json()) as GeoNamesOdsResponse;
  return {
    results: (json.results ?? []).map(mapOdsCity).filter((x): x is CitySearchResult => !!x),
    totalCount: json.total_count ?? 0,
  };
};
