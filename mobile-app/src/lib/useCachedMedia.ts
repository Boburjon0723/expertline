import { useEffect, useState } from "react";
import { getCachedMediaUri, peekCachedMediaUriSync, subscribeMediaCache, type MediaKind } from "./media-cache";
import { subscribeMediaPrefs } from "./media-prefs";

export function useCachedMedia(
  uri: string | null | undefined,
  kind?: MediaKind,
  force = false
) {
  const [localUri, setLocalUri] = useState<string | null>(() => peekCachedMediaUriSync(uri));
  const [needsDownload, setNeedsDownload] = useState(false);
  const [prefTick, setPrefTick] = useState(0);

  useEffect(() => subscribeMediaPrefs(() => setPrefTick((n) => n + 1)), []);
  useEffect(() => subscribeMediaCache(() => setPrefTick((n) => n + 1)), []);

  useEffect(() => {
    if (!uri) {
      setLocalUri(null);
      setNeedsDownload(false);
      return;
    }
    if (uri.startsWith("file:") || uri.startsWith("data:")) {
      setLocalUri(uri);
      setNeedsDownload(false);
      return;
    }
    let alive = true;
    void getCachedMediaUri(uri, kind, { force })
      .then((p) => {
        if (!alive) return;
        if (p) {
          setLocalUri(p);
          setNeedsDownload(false);
        } else {
          setLocalUri(null);
          setNeedsDownload(true);
        }
      })
      .catch(() => {
        if (alive) {
          setLocalUri(null);
          setNeedsDownload(!force);
        }
      });
    return () => {
      alive = false;
    };
  }, [uri, kind, force, prefTick]);

  return { localUri, needsDownload };
}
