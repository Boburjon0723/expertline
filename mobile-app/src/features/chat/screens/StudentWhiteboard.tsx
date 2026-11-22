import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, View } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Eraser, Trash2 } from "lucide-react-native";
import { getSocket } from "../../../lib/socket";

type Seg = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
  lineWidth: number;
  authorId: string;
};

const COLORS = ["#ffffff", "#3b82f6", "#ef4444", "#22c55e", "#eab308", "#a855f7"];
const ERASE_RADIUS = 0.028;

function roomOk(a: unknown, b: string) {
  return String(a || "").trim().toLowerCase() === String(b).trim().toLowerCase();
}

function eraseNear(list: Seg[], x: number, y: number, onlyAuthor: string | null): Seg[] {
  return list.filter((s) => {
    if (onlyAuthor && String(s.authorId) !== onlyAuthor) return true;
    const mx = (s.x0 + s.x1) / 2;
    const my = (s.y0 + s.y1) / 2;
    return Math.hypot(x - mx, y - my) > ERASE_RADIUS;
  });
}

export function StudentWhiteboard({
  sessionId,
  userId,
  showToolbar = true,
  onActivity,
}: {
  sessionId: string;
  userId?: string;
  showToolbar?: boolean;
  onActivity?: () => void;
}) {
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [strokes, setStrokes] = useState<Seg[]>([]);
  const [color, setColor] = useState("#3b82f6");
  const [eraserOn, setEraserOn] = useState(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const colorRef = useRef(color);
  const eraserRef = useRef(eraserOn);
  const userRef = useRef(String(userId || ""));
  const activityRef = useRef(onActivity);
  colorRef.current = color;
  eraserRef.current = eraserOn;
  userRef.current = String(userId || "");
  activityRef.current = onActivity;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) setSize({ w: width, h: height });
  };

  useEffect(() => {
    if (!sessionId) return;
    let attached: ReturnType<typeof getSocket> = null;
    const onDraw = (data: any) => {
      if (!roomOk(data?.sessionId, sessionId)) return;
      if (data?.color === "eraser") return;
      const x0 = data.x0 ?? data.x;
      const y0 = data.y0 ?? data.y;
      const x1 = data.x1 ?? data.x;
      const y1 = data.y1 ?? data.y;
      if (x0 == null || y0 == null) return;
      setStrokes((p) => [
        ...p,
        {
          x0: Number(x0),
          y0: Number(y0),
          x1: Number(x1),
          y1: Number(y1),
          color: String(data.color || "#e2e8f0"),
          lineWidth: Number(data.lineWidth) || 3,
          authorId: data.authorId != null ? String(data.authorId) : "",
        },
      ]);
    };
    const onClear = (data: any) => {
      if (!roomOk(data?.sessionId, sessionId)) return;
      setStrokes([]);
    };
    const onClearAuthor = (data: any) => {
      if (!roomOk(data?.sessionId, sessionId)) return;
      const aid = String(data?.authorId || "");
      if (!aid) return;
      setStrokes((p) => p.filter((s) => s.authorId !== aid));
    };
    const onEraseNear = (data: any) => {
      if (!roomOk(data?.sessionId, sessionId)) return;
      const only =
        data?.authorId != null && String(data.authorId) !== "" ? String(data.authorId) : null;
      setStrokes((p) => eraseNear(p, Number(data.x), Number(data.y), only));
    };
    const attach = () => {
      const socket = getSocket();
      if (!socket?.connected || attached === socket) return;
      if (attached) {
        attached.off("whiteboard:draw", onDraw);
        attached.off("whiteboard:clear", onClear);
        attached.off("whiteboard:clear_author", onClearAuthor);
        attached.off("whiteboard:erase_near", onEraseNear);
      }
      attached = socket;
      socket.on("whiteboard:draw", onDraw);
      socket.on("whiteboard:clear", onClear);
      socket.on("whiteboard:clear_author", onClearAuthor);
      socket.on("whiteboard:erase_near", onEraseNear);
    };
    attach();
    const poll = setInterval(attach, 2000);
    return () => {
      clearInterval(poll);
      if (attached) {
        attached.off("whiteboard:draw", onDraw);
        attached.off("whiteboard:clear", onClear);
        attached.off("whiteboard:clear_author", onClearAuthor);
        attached.off("whiteboard:erase_near", onEraseNear);
      }
    };
  }, [sessionId]);

  const emitSeg = useCallback(
    (seg: Seg) => {
      getSocket()?.emit("whiteboard:draw", { sessionId, ...seg });
    },
    [sessionId]
  );

  const emitErase = useCallback(
    (x: number, y: number) => {
      const aid = userRef.current;
      if (!aid) return;
      setStrokes((p) => eraseNear(p, x, y, aid));
      getSocket()?.emit("whiteboard:erase_near", {
        sessionId,
        x,
        y,
        radius: ERASE_RADIUS,
        authorId: aid,
      });
    },
    [sessionId]
  );

  const clearMine = () => {
    const aid = userRef.current;
    if (!aid) return;
    setStrokes((p) => p.filter((s) => s.authorId !== aid));
    getSocket()?.emit("whiteboard:clear_author", { sessionId, authorId: aid });
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          activityRef.current?.();
          const { locationX, locationY } = evt.nativeEvent;
          const x = locationX / size.w;
          const y = locationY / size.h;
          lastRef.current = { x, y };
          if (eraserRef.current) emitErase(x, y);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const nx = locationX / size.w;
          const ny = locationY / size.h;
          if (eraserRef.current) {
            emitErase(nx, ny);
            lastRef.current = { x: nx, y: ny };
            return;
          }
          const last = lastRef.current;
          if (!last) {
            lastRef.current = { x: nx, y: ny };
            return;
          }
          const seg: Seg = {
            x0: last.x,
            y0: last.y,
            x1: nx,
            y1: ny,
            color: colorRef.current,
            lineWidth: 3,
            authorId: userRef.current,
          };
          setStrokes((p) => [...p, seg]);
          emitSeg(seg);
          lastRef.current = { x: nx, y: ny };
        },
        onPanResponderRelease: () => {
          lastRef.current = null;
        },
      }),
    [size.w, size.h, emitSeg, emitErase]
  );

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <View style={styles.canvas} {...pan.panHandlers}>
        {size.w <= 2 ? null : (
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
            {strokes.map((s, i) => (
              <Line
                key={i}
                x1={s.x0 * size.w}
                y1={s.y0 * size.h}
                x2={s.x1 * size.w}
                y2={s.y1 * size.h}
                stroke={s.color === "#ffffff" || s.color === "#fff" ? "#e2e8f0" : s.color}
                strokeWidth={Math.max(2, s.lineWidth)}
                strokeLinecap="round"
              />
            ))}
          </Svg>
        )}
      </View>

      {showToolbar ? (
        <View style={styles.toolbar} pointerEvents="box-none">
          {COLORS.map((c) => {
            const on = !eraserOn && color === c;
            return (
              <Pressable
                key={c}
                onPress={() => {
                  activityRef.current?.();
                  setColor(c);
                  setEraserOn(false);
                }}
                style={[styles.swatchWrap, on && styles.swatchOn]}
              >
                <View style={[styles.swatch, { backgroundColor: c }]} />
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              activityRef.current?.();
              setEraserOn(true);
            }}
            style={[styles.toolBtn, eraserOn && styles.toolBtnOn]}
          >
            <Eraser color="#fff" size={18} />
          </Pressable>
          <Pressable
            onPress={() => {
              activityRef.current?.();
              clearMine();
            }}
            style={styles.toolBtn}
          >
            <Trash2 color="#fbbf24" size={18} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#0f172a" },
  canvas: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  toolbar: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 10,
    zIndex: 30,
    elevation: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: "rgba(8,12,22,0.72)",
  },
  swatchWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  swatchOn: { backgroundColor: "rgba(255,255,255,0.28)", borderWidth: 2, borderColor: "#fff" },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)" },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  toolBtnOn: { backgroundColor: "rgba(255,255,255,0.28)" },
});
