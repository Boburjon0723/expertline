import React from "react";
import { Linking, Text, type StyleProp, type TextStyle } from "react-native";

/** http(s)://... yoki www.... — web MessageBubble bilan bir xil qoida */
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
/** Gap oxiridagi tinish belgilari linkka kirmasin: "https://x.uz." → "https://x.uz" + "." */
const TRAILING_RE = /[.,!?;:'"»)\]}]+$/;

export type TextPart = { text: string; url?: string };

export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let raw = m[0];
    const trail = raw.match(TRAILING_RE)?.[0] ?? "";
    if (trail) raw = raw.slice(0, raw.length - trail.length);
    if (!raw) continue;
    if (start > last) parts.push({ text: text.slice(last, start) });
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    parts.push({ text: raw, url });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}

type Props = {
  children: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
  /** Link ustida uzoq bosish — xabar menyusi ochilsin */
  onLongPress?: () => void;
};

/** Xabar matni: linklar ajratib ko'rsatiladi va bosilganda brauzerda ochiladi */
export function LinkifiedText({ children, style, linkStyle, onLongPress }: Props) {
  const parts = splitLinks(children);
  if (!parts.some((p) => p.url)) return <Text style={style}>{children}</Text>;
  return (
    <Text style={style}>
      {parts.map((p, i) =>
        p.url ? (
          <Text
            key={i}
            style={[{ color: "#8ab4ff", textDecorationLine: "underline" }, linkStyle]}
            onPress={() => void Linking.openURL(p.url!).catch(() => {})}
            onLongPress={onLongPress}
            suppressHighlighting={false}
          >
            {p.text}
          </Text>
        ) : (
          <Text key={i}>{p.text}</Text>
        )
      )}
    </Text>
  );
}
