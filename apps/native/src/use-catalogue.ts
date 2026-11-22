import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { loadCatalogue } from "./api";
import type { Catalogue } from "./types";

const savedKey = "backinit-native-saved-v1";
const catalogueKey = "backinit-native-catalogue-v1";
const empty: Catalogue = { broadcasts: [], videos: [] };

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState(empty);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await loadCatalogue();
      setCatalogue((current) => {
        const merged = {
          broadcasts: next.broadcasts.length ? next.broadcasts : current.broadcasts,
          videos: next.videos.length ? next.videos : current.videos,
        };
        void AsyncStorage.setItem(catalogueKey, JSON.stringify(merged));
        return merged;
      });
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not refresh sport");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(catalogueKey)
      .then((value) => {
        if (!active || !value) return;
        setCatalogue(JSON.parse(value) as Catalogue);
        setLoading(false);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) void refresh();
      });
    void AsyncStorage.getItem(savedKey).then((value) => {
      if (active && value) setSaved(JSON.parse(value) as string[]);
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const toggleSaved = useCallback((id: string) => {
    setSaved((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      void AsyncStorage.setItem(savedKey, JSON.stringify(next));
      return next;
    });
  }, []);

  const savedSet = useMemo(() => new Set(saved), [saved]);
  return { catalogue, savedSet, loading, refreshing, error, refresh, toggleSaved };
}
