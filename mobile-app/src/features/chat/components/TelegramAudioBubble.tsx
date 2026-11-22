import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowDown, Play, X } from "lucide-react-native";
import {
  cancelMediaDownload,
  peekCachedMediaUri,
  startMediaDownload,
  subscribeMediaCache,
} from "../../../lib/media-cache";
import { mobileSongPlayer, type MobileSongTrack } from "../../../lib/mobile-song-player";

function fmtMb(n: number) {
  if (n <= 0) return "0.0 MB";
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDur(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

type Props = {
  uri: string;
  fileName: string;
  fileSize?: number | null;
  messageId: string;
  chatId: string;
  playlist: MobileSongTrack[];
  onLongPress?: () => void;
};

export function TelegramAudioBubble({
  uri,
  fileName,
  fileSize,
  messageId,
  chatId,
  playlist,
  onLongPress,
}: Props) {
  const songId = useSyncExternalStore(
    mobileSongPlayer.subscribe,
    () => {
      const s = mobileSongPlayer.getSnapshot();
      const on = s.track?.id === messageId || s.track?.uri === uri;
      const dur = on ? Math.round((s.duration || 0) * 10) : 0;
      const t = on ? Math.round((s.currentTime || 0) * 10) : 0;
      return `${on ? 1 : 0}:${s.playing && on ? 1 : 0}:${dur}:${t}`;
    },
    () => "0:0:0:0"
  );
  const onThis = songId.startsWith("1");
  const playing = songId.split(":")[1] === "1";

  const asTrack = (local?: string | null): MobileSongTrack => ({
    id: messageId,
    uri,
    title: fileName.replace(/\.[^.]+$/, "") || fileName,
    localUri: local,
    chatId,
    fileSize: fileSize || null,
  });
  const [cached, setCached] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [written, setWritten] = useState(0);
  const [total, setTotal] = useState(fileSize || 0);

  const refreshPeek = useCallback(async () => {
    const p = await peekCachedMediaUri(uri, "audio");
    setCached(!!p);
    setLocalUri(p);
    if (p) setDownloading(false);
  }, [uri]);

  useEffect(() => {
    void refreshPeek();
    return subscribeMediaCache(() => {
      void refreshPeek();
    });
  }, [refreshPeek]);

  const startDl = async (thenPlay?: boolean) => {
    setDownloading(true);
    setWritten(0);
    try {
      const path = await startMediaDownload(uri, "audio", (w, t) => {
        setWritten(w);
        if (t) setTotal(t);
      });
      setLocalUri(path);
      setCached(true);
      setDownloading(false);
      if (thenPlay) {
        await mobileSongPlayer.play(asTrack(path), playlist);
      }
    } catch {
      setDownloading(false);
      await refreshPeek();
    }
  };

  const cancelDl = async () => {
    await cancelMediaDownload(uri);
    setDownloading(false);
    setWritten(0);
    await refreshPeek();
  };

  const togglePlay = async () => {
    if (!cached) {
      if (!downloading) void startDl(true);
      return;
    }
    try {
      if (onThis) {
        await mobileSongPlayer.toggle();
        return;
      }
      await mobileSongPlayer.play(asTrack(localUri), playlist);
    } catch {
      /* play failed — UI stays idle */
    }
  };

  const progress = total > 0 ? Math.min(1, written / total) : 0;
  const snap = onThis ? mobileSongPlayer.getSnapshot() : null;
  const timeLabel =
    snap && (snap.duration > 0 || snap.currentTime > 0)
      ? `${fmtDur(snap.currentTime * 1000)}${snap.duration ? ` / ${fmtDur(snap.duration * 1000)}` : ""}`
      : "—";
  const sub = downloading
    ? `${fmtMb(written)} / ${fmtMb(total || fileSize || 0)}`
    : `${timeLabel} · ${fmtMb(fileSize || total || 0)}`;

  return (
    <Pressable style={styles.row} onLongPress={onLongPress} delayLongPress={280}>
      <View style={styles.playWrap}>
        <Pressable
          onPress={() => void togglePlay()}
          onLongPress={onLongPress}
          delayLongPress={280}
          style={styles.play}
        >
          {playing ? <View style={styles.pause} /> : <Play color="#fff" size={22} fill="#fff" />}
        </Pressable>
        {!cached ? (
          downloading ? (
            <Pressable onPress={() => void cancelDl()} style={styles.badge}>
              <View style={styles.ringBg} />
              <View style={[styles.dotSpin, { transform: [{ rotate: `${progress * 360}deg` }] }]}>
                <View style={styles.dot} />
              </View>
              <View style={styles.badgeInner}>
                <X color="#5eb5f7" size={11} strokeWidth={3} />
              </View>
            </Pressable>
          ) : (
            <Pressable onPress={() => void startDl()} style={styles.badge}>
              <View style={[styles.badgeInner, styles.badgeDl]}>
                <ArrowDown color="#fff" size={12} strokeWidth={3} />
              </View>
            </Pressable>
          )
        ) : null}
      </View>
      <Pressable onPress={() => undefined} onLongPress={onLongPress} delayLongPress={280} style={styles.meta}>
        <Text style={styles.name} numberOfLines={2}>
          {fileName}
        </Text>
        <Text style={styles.sub}>{sub}</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 240,
    maxWidth: 280,
    paddingVertical: 2,
  },
  playWrap: {
    width: 52,
    height: 52,
    marginRight: 10,
  },
  play: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#64b5ef",
    alignItems: "center",
    justifyContent: "center",
  },
  pause: {
    width: 14,
    height: 14,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderColor: "#fff",
  },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ringBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.28)",
  },
  dotSpin: {
    ...StyleSheet.absoluteFillObject,
  },
  dot: {
    position: "absolute",
    top: -1,
    alignSelf: "center",
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#fff",
  },
  badgeInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDl: {
    backgroundColor: "#2b6cb0",
  },
  meta: { flex: 1, minWidth: 0 },
  name: { color: "#fff", fontSize: 15, fontWeight: "600" },
  sub: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 },
});
