import * as ImageManipulator from "expo-image-manipulator";
import * as VideoThumbnails from "expo-video-thumbnails";

/**
 * Telegram uslubidagi kichik nusxa (data URI), yuborishdan oldin telefonda yaratiladi va metadata ga
 * yoziladi. Rasm: 24 px (qabul qiluvchida xira fon). Video: 160 px birinchi kadr (deyarli tiniq preview).
 * Xato bo'lsa null — yuborish to'xtamaydi.
 */
const IMAGE_EDGE = 24;
const VIDEO_EDGE = 160;

async function resizeToDataUri(uri: string, edge: number, w?: number, h?: number): Promise<string | null> {
  const landscape = (w || 1) >= (h || 1);
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: landscape ? { width: edge } : { height: edge } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  return out.base64 ? `data:image/jpeg;base64,${out.base64}` : null;
}

export async function createMediaThumb(
  uri: string,
  kind: "image" | "video",
  w?: number,
  h?: number
): Promise<string | null> {
  try {
    if (kind === "image") return await resizeToDataUri(uri, IMAGE_EDGE, w, h);
    const frame = await VideoThumbnails.getThumbnailAsync(uri, { time: 100, quality: 0.6 });
    return await resizeToDataUri(frame.uri, VIDEO_EDGE, frame.width, frame.height);
  } catch (e) {
    console.warn("[media-thumb]", e);
    return null;
  }
}
