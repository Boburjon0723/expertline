/**
 * Mobile LiveKit audio — ovoz aniqligi uchun.
 * livekit-client import yo‘q (lazy load / start crash oldini).
 *
 * Eslatma: sampleRate majburlanmaydi — ba’zi Androidlarda 48k force
 * past/muffled ovoz beradi. DTX o‘chiq — gap boshini “yeb” qo‘ymasligi uchun.
 */
export const LIVEKIT_AUDIO_CAPTURE = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

/** Yuqori bitrate + DTX off — mentorga aniqroq eshitiladi */
export const LIVEKIT_AUDIO_PUBLISH = {
  audioPreset: { maxBitrate: 96_000 },
  dtx: false,
  red: true,
};

export function liveKitRoomOptionsMobile(kind: "call" | "panel" = "call") {
  return {
    // 1:1 qo'ng'iroq Modal ichida ochiladi: adaptiveStream video oynani "ko'rinmas/0 o'lcham"
    // deb hisoblab, remote videoni to'xtatib qo'yardi (web ko'radi, telefon ko'rmaydi).
    // Ko'p ishtirokchili panelda (guruh darsi) trafik tejash uchun yoqilgan qoladi.
    adaptiveStream: kind === "panel",
    dynacast: true,
    audioCaptureDefaults: { ...LIVEKIT_AUDIO_CAPTURE },
    publishDefaults: { ...LIVEKIT_AUDIO_PUBLISH },
  };
}
