import { AppState } from "react-native";
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";
import { peekCachedMediaUri } from "./media-cache";

export type MobileSongTrack = {
  id: string;
  uri: string;
  title: string;
  localUri?: string | null;
  chatId?: string;
  fileSize?: number | null;
};

export type MobileSongState = {
  track: MobileSongTrack | null;
  playlist: MobileSongTrack[];
  playing: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  repeatOne: boolean;
};

const listeners = new Set<() => void>();
const foreignStops = new Set<() => void | Promise<void>>();

let sound: Audio.Sound | null = null;
let playGen = 0;
let userWantsPlay = false;
let holdCount = 0;
let sysResumeTimer: ReturnType<typeof setTimeout> | null = null;

let state: MobileSongState = {
  track: null,
  playlist: [],
  playing: false,
  currentTime: 0,
  duration: 0,
  rate: 1,
  repeatOne: false,
};

let lastUiEmit = 0;

function videoHold() {
  return holdCount > 0;
}

function emit() {
  lastUiEmit = Date.now();
  listeners.forEach((fn) => fn());
}

function emitThrottled() {
  const now = Date.now();
  if (now - lastUiEmit < 220) return;
  emit();
}

function trackKey(t: MobileSongTrack | null) {
  if (!t) return "";
  return t.id || t.uri;
}

async function killSound(s: Audio.Sound | null) {
  if (!s) return;
  try {
    s.setOnPlaybackStatusUpdate(null);
  } catch {
    /* ignore */
  }
  try {
    await s.setVolumeAsync(0);
  } catch {
    /* ignore */
  }
  try {
    await s.pauseAsync();
  } catch {
    /* ignore */
  }
  try {
    await s.stopAsync();
  } catch {
    /* ignore */
  }
  try {
    await s.unloadAsync();
  } catch {
    /* ignore */
  }
}

function clearTimers() {
  if (sysResumeTimer) {
    clearTimeout(sysResumeTimer);
    sysResumeTimer = null;
  }
}

async function unloadSound() {
  const s = sound;
  sound = null;
  await killSound(s);
}

async function stopForeignAudio() {
  for (const fn of [...foreignStops]) {
    try {
      await fn();
    } catch {
      /* ignore */
    }
  }
}

export function registerForeignAudioStop(fn: () => void | Promise<void>) {
  foreignStops.add(fn);
  return () => {
    foreignStops.delete(fn);
  };
}

export async function ensureSpeakerPlayback() {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      playThroughEarpieceAndroid: false,
      shouldDuckAndroid: false,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    });
  } catch {
    /* Expo Go / emulator */
  }
}

export async function restoreSongLoudness() {
  if (videoHold() || !userWantsPlay || !sound || !state.track) return;
  try {
    const st = await sound.getStatusAsync();
    if (!st.isLoaded) return;
    try {
      await sound.setVolumeAsync(1);
    } catch {
      /* ignore */
    }
    if (st.isPlaying) {
      if (!state.playing) {
        state = { ...state, playing: true };
        emit();
      }
      return;
    }
    await sound.playAsync();
    state = { ...state, playing: true };
    emit();
  } catch {
    /* ignore */
  }
}

function scheduleSystemResume() {
  if (!userWantsPlay || videoHold()) return;
  if (sysResumeTimer) clearTimeout(sysResumeTimer);
  sysResumeTimer = setTimeout(() => {
    sysResumeTimer = null;
    void restoreSongLoudness();
  }, 180);
}

export async function resumeSongIfNeeded() {
  if (videoHold() || !sound || !userWantsPlay || !state.track) return;
  try {
    await restoreSongLoudness();
  } catch {
    /* ignore */
  }
}

export const mobileSongPlayer = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot(): MobileSongState {
    return state;
  },
  async play(track: MobileSongTrack, playlist?: MobileSongTrack[]) {
    const gen = ++playGen;
    await stopForeignAudio();
    if (playlist && playlist.length) {
      state = { ...state, playlist };
    } else if (!state.playlist.some((t) => trackKey(t) === trackKey(track))) {
      state = { ...state, playlist: [...state.playlist, track] };
    }

    const same = trackKey(state.track) === trackKey(track) && sound;
    if (same) {
      userWantsPlay = true;
      try {
        const st = await sound!.getStatusAsync();
        if (st.isLoaded) {
          await sound!.setPositionAsync(0);
          if (gen !== playGen) return;
          await resumeSongIfNeeded();
          return;
        }
      } catch {
        /* recreate below */
      }
    }

    userWantsPlay = true;
    await unloadSound();
    if (gen !== playGen) return;

    await ensureSpeakerPlayback();
    if (gen !== playGen) return;

    let uri = track.localUri || track.uri;
    if (!track.localUri) {
      try {
        const cached = await peekCachedMediaUri(track.uri, "audio");
        if (cached) uri = cached;
      } catch {
        /* remote */
      }
    }
    if (gen !== playGen) return;

    let s: Audio.Sound;
    try {
      const created = await Audio.Sound.createAsync(
        { uri },
        {
          shouldPlay: !videoHold(),
          volume: 1,
          rate: state.rate,
          shouldCorrectPitch: true,
          progressUpdateIntervalMillis: 250,
        }
      );
      s = created.sound;
    } catch {
      if (gen !== playGen) return;
      userWantsPlay = false;
      state = { ...state, track, playing: false, currentTime: 0, duration: 0 };
      emit();
      return;
    }
    if (gen !== playGen) {
      await killSound(s);
      return;
    }

    sound = s;
    state = {
      ...state,
      track: { ...track, localUri: uri.startsWith("file:") ? uri : track.localUri },
      playing: !videoHold(),
      currentTime: 0,
      duration: 0,
    };
    emit();

    s.setOnPlaybackStatusUpdate((st) => {
      if (gen !== playGen || sound !== s) return;
      if (!st.isLoaded) return;
      if (st.didJustFinish) {
        clearTimers();
        if (state.repeatOne && userWantsPlay) {
          void s.setPositionAsync(0).then(() => s.playAsync());
          return;
        }
        void mobileSongPlayer.next();
        return;
      }
      const playing = videoHold() ? false : userWantsPlay ? st.isPlaying : false;
      const playingChanged = playing !== state.playing;
      state = {
        ...state,
        playing,
        currentTime: (st.positionMillis || 0) / 1000,
        duration: (st.durationMillis || 0) / 1000,
      };
      if (playingChanged) emit();
      else emitThrottled();
      if (userWantsPlay && !videoHold() && !st.isPlaying) {
        scheduleSystemResume();
      }
    });
  },
  async next() {
    const list = state.playlist;
    if (list.length < 2) {
      userWantsPlay = false;
      clearTimers();
      state = { ...state, playing: false, currentTime: 0 };
      emit();
      return;
    }
    const cur = list.findIndex((t) => trackKey(t) === trackKey(state.track));
    const n = cur < 0 || cur >= list.length - 1 ? 0 : cur + 1;
    await mobileSongPlayer.play(list[n]);
  },
  async prev() {
    const list = state.playlist;
    if (list.length < 2) return;
    const cur = list.findIndex((t) => trackKey(t) === trackKey(state.track));
    const n = cur <= 0 ? list.length - 1 : cur - 1;
    await mobileSongPlayer.play(list[n]);
  },
  async seek(seconds: number) {
    if (!sound || !state.track) return;
    const dur = state.duration || 0;
    const t = Math.max(0, dur > 0 ? Math.min(seconds, dur) : seconds);
    try {
      await sound.setPositionAsync(t * 1000);
      state = { ...state, currentTime: t };
      emit();
    } catch {
      /* ignore */
    }
  },
  async toggle() {
    if (!state.track) return;
    if (userWantsPlay && state.playing) {
      userWantsPlay = false;
      clearTimers();
      try {
        await sound?.pauseAsync();
      } catch {
        /* ignore */
      }
      state = { ...state, playing: false };
      emit();
      return;
    }
    userWantsPlay = true;
    if (!sound) {
      await mobileSongPlayer.play(state.track, state.playlist);
      return;
    }
    try {
      const st = await sound.getStatusAsync();
      if (!st.isLoaded) {
        await mobileSongPlayer.play(state.track, state.playlist);
        return;
      }
    } catch {
      await mobileSongPlayer.play(state.track, state.playlist);
      return;
    }
    await resumeSongIfNeeded();
  },
  async close() {
    playGen += 1;
    userWantsPlay = false;
    holdCount = 0;
    clearTimers();
    state = {
      ...state,
      track: null,
      playlist: [],
      playing: false,
      currentTime: 0,
      duration: 0,
    };
    emit();
    await unloadSound();
  },
  async cycleRate() {
    const next = state.rate >= 2 ? 1 : state.rate >= 1.5 ? 2 : 1.5;
    state = { ...state, rate: next };
    if (sound) {
      try {
        await sound.setRateAsync(next, true);
      } catch {
        /* ignore */
      }
    }
    emit();
  },
  toggleRepeatOne() {
    state = { ...state, repeatOne: !state.repeatOne };
    emit();
  },
};

export async function holdSongForVideo() {
  holdCount += 1;
  state = { ...state, playing: false };
  emit();
  if (sound) {
    try {
      await sound.pauseAsync();
    } catch {
      /* ignore */
    }
  }
}

export async function releaseSongFromVideo() {
  holdCount = Math.max(0, holdCount - 1);
  if (holdCount > 0) return;
  if (!userWantsPlay || !sound) return;
  try {
    await sound.playAsync();
    state = { ...state, playing: true };
    emit();
  } catch {
    await resumeSongIfNeeded();
  }
}

/** Holdni kamaytiradi, qo‘shiqni qayta yoqmaydi (boshqa pleyer o‘zi chalyapti). */
export function dropSongHold() {
  holdCount = Math.max(0, holdCount - 1);
}

AppState.addEventListener("change", (next) => {
  if (next !== "active") return;
  if (userWantsPlay && !videoHold()) {
    void restoreSongLoudness();
  }
});
