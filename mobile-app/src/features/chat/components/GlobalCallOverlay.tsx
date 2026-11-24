import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { useAuthLocale } from "../../auth/locale";
import { useAuthStore } from "../../auth/store";
import { getSocket } from "../../../lib/socket";
import { getLiveKitTokenRequest } from "../service";
import { navigationRef } from "../../../lib/navigationRef";
import { TelegramCallScreen, CallVideoStage, CallMediaSync, CallPeerLeftWatch } from "./TelegramCallScreen";
import { holdSongForVideo, releaseSongFromVideo } from "../../../lib/mobile-song-player";
import { ensureCallMediaPermissions } from "../../../lib/call-media-permissions";
import {
  getLiveKitModules,
  getLiveKitUnavailableReason,
  isLiveKitNativeAvailable,
  startLiveKitAudioSession,
  stopLiveKitAudioSession,
} from "../../../lib/livekit-call-session";
import { liveKitRoomOptionsMobile } from "../../../lib/livekit-media";
import { startIncomingRing, stopCallSounds } from "../../../lib/call-sounds";

type IncomingPayload = {
  from: string;
  name?: string;
  fromName?: string;
  signal?: unknown;
  callType?: string;
  chatId?: string;
  callId?: string;
};

type CallUiStatus = "incoming" | "connected";

function formatCallDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * App-root incoming call UI. ChatDetail keeps outgoing CallModal;
 * incoming_call is handled only here to avoid duplicate handlers.
 */
export function GlobalCallOverlay() {
  const { t } = useAuthLocale();
  const user = useAuthStore((s) => s.user);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<CallUiStatus>("incoming");
  const [callType, setCallType] = useState<"audio" | "video">("audio");
  const [peerName, setPeerName] = useState("");
  const [peerId, setPeerId] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkWsUrl, setLkWsUrl] = useState<string | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const activeRef = useRef(false);
  /** joinLive bir vaqtda faqat bir marta (aks holda ikki token/ikki ulanish bo'lib, video uziladi). */
  const joiningRef = useRef(false);
  const statusRef = useRef(status);
  const chatIdRef = useRef(chatId);
  const peerIdRef = useRef(peerId);
  statusRef.current = status;
  chatIdRef.current = chatId;
  peerIdRef.current = peerId;

  const reset = useCallback(() => {
    activeRef.current = false;
    joiningRef.current = false;
    setVisible(false);
    setStatus("incoming");
    setPeerId(null);
    setChatId(null);
    setLkToken(null);
    setLkWsUrl(null);
    setIsMicMuted(false);
    setIsCamOff(false);
    setElapsed(0);
    void stopLiveKitAudioSession();
  }, []);

  const joinLive = useCallback(
    async (roomId: string | null | undefined, media: "audio" | "video" = callType) => {
      const sessionId = String(roomId || "").trim();
      if (joiningRef.current) return;
      joiningRef.current = true;
      if (!sessionId) {
        Alert.alert(t("loginErrorGeneric"), "Sessiya ID topilmadi");
        joiningRef.current = false;
        return;
      }
      const lk = getLiveKitModules()?.LiveKit;
      if (!isLiveKitNativeAvailable() || !lk) {
        Alert.alert(t("loginErrorGeneric"), getLiveKitUnavailableReason());
        reset();
        return;
      }
      const ok = await ensureCallMediaPermissions(media);
      if (!ok) {
        reset();
        return;
      }
      await startLiveKitAudioSession(media === "video" ? "speaker" : "earpiece");
      setStatus("connected");
      setVisible(true);
      const socket = getSocket();
      if (socket) {
        socket.emit("join_room", sessionId);
        socket.emit("session_join", { sessionId });
      }
      try {
        const username = useAuthStore.getState().user?.name || "User";
        const data = await getLiveKitTokenRequest(sessionId, username);
        if (data?.token && data?.wsUrl) {
          setLkToken(data.token);
          setLkWsUrl(data.wsUrl);
        } else {
          throw new Error("Token yoki wsUrl yo'q");
        }
      } catch (e) {
        console.error("[GlobalCall] LiveKit join error:", e);
        Alert.alert(t("loginErrorGeneric"), t("callError"));
        reset();
      }
    },
    [reset, t, callType]
  );

  const joinLiveRef = useRef(joinLive);
  const resetRef = useRef(reset);
  joinLiveRef.current = joinLive;
  resetRef.current = reset;

  useEffect(() => {
    if (!user) {
      resetRef.current();
      return;
    }

    let cancelled = false;
    let sock: ReturnType<typeof getSocket> = null;

    const onIncoming = (data: IncomingPayload) => {
      if (activeRef.current) return;
      activeRef.current = true;
      const name = data.fromName || data.name || "User";
      setPeerName(name);
      setPeerId(String(data.from));
      setChatId(data.chatId ? String(data.chatId) : null);
      setCallType(data.callType === "video" ? "video" : "audio");
      setStatus("incoming");
      setLkToken(null);
      setVisible(true);
    };

    const onAccepted = (data?: { from?: string }) => {
      if (!activeRef.current || statusRef.current !== "incoming") return;
      // Server qabul qilgan tomonga ham call_accepted qaytaradi — bu o'z javobimiz, acceptCall allaqachon ulanmoqda.
      const me = useAuthStore.getState().user?.id;
      if (data?.from && me && String(data.from) === String(me)) return;
      void joinLiveRef.current(chatIdRef.current);
    };

    const onRejectedOrEnded = () => {
      if (!activeRef.current) return;
      resetRef.current();
    };

    // Shu akkauntning boshqa qurilmasida javob berildi yoki rad etildi — bu yerda jiringlashni to'xtatamiz.
    const onHandledElsewhere = () => {
      if (!activeRef.current || statusRef.current !== "incoming") return;
      resetRef.current();
    };

    const attach = () => {
      const socket = getSocket();
      if (!socket || cancelled) return;
      if (sock === socket) return;
      if (sock) {
        sock.off("incoming_call", onIncoming);
        sock.off("call_accepted", onAccepted);
        sock.off("call_rejected", onRejectedOrEnded);
        sock.off("call_ended", onRejectedOrEnded);
        sock.off("call_handled_elsewhere", onHandledElsewhere);
      }
      socket.on("incoming_call", onIncoming);
      socket.on("call_accepted", onAccepted);
      socket.on("call_rejected", onRejectedOrEnded);
      socket.on("call_ended", onRejectedOrEnded);
      socket.on("call_handled_elsewhere", onHandledElsewhere);
      sock = socket;
    };

    attach();
    const poll = setInterval(attach, 2000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      if (sock) {
        sock.off("incoming_call", onIncoming);
        sock.off("call_accepted", onAccepted);
        sock.off("call_rejected", onRejectedOrEnded);
        sock.off("call_ended", onRejectedOrEnded);
        sock.off("call_handled_elsewhere", onHandledElsewhere);
      }
    };
  }, [user]);

  useEffect(() => {
    if (!visible || status !== "connected") {
      setElapsed(0);
      return;
    }
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [visible, status]);

  useEffect(() => {
    if (!visible || status !== "incoming") return;
    startIncomingRing();
    return () => stopCallSounds();
  }, [visible, status]);

  const acceptCall = async () => {
    stopCallSounds();
    const socket = getSocket();
    const to = peerIdRef.current;
    const room = chatIdRef.current;
    if (socket && to) {
      socket.emit("accept_call", {
        to,
        chatId: room,
        signal: { type: "livekit" },
      });
    }
    if (room && navigationRef.isReady()) {
      try {
        navigationRef.navigate("ChatDetail", {
          chatId: String(room),
          name: peerName || "Chat",
          avatarUrl: null,
        });
      } catch {
        /* optional */
      }
    }
    await joinLive(room, callType);
  };

  const rejectCall = () => {
    const socket = getSocket();
    if (socket && peerIdRef.current) {
      socket.emit("reject_call", { to: peerIdRef.current, chatId: chatIdRef.current });
    }
    reset();
  };

  const endCall = () => {
    const socket = getSocket();
    if (socket && peerIdRef.current) {
      socket.emit("end_call", { to: peerIdRef.current, chatId: chatIdRef.current });
    }
    reset();
  };

  useEffect(() => {
    if (!visible) return;
    void holdSongForVideo();
    return () => {
      void releaseSongFromVideo();
    };
  }, [visible]);

  if (!visible) return null;

  const timerLabel = formatCallDuration(elapsed);
  const LiveKit = getLiveKitModules()?.LiveKit;
  const videoSlot =
    status === "connected" && lkToken && lkWsUrl && LiveKit ? (
      <LiveKit.LiveKitRoom
        token={lkToken}
        serverUrl={lkWsUrl}
        connect
        audio={true}
        video={callType === "video"}
        options={liveKitRoomOptionsMobile("call")}
        onError={(e: unknown) => {
          console.error("LiveKit Error:", e);
          Alert.alert(t("loginErrorGeneric"), t("callError"));
        }}
      >
        <CallMediaSync micOn={!isMicMuted} camOn={callType === "video" && !isCamOff} />
        <CallPeerLeftWatch onPeerLeft={endCall} />
        {callType === "video" ? <CallVideoStage name={peerName} isCamOff={isCamOff} /> : null}
      </LiveKit.LiveKitRoom>
    ) : null;

  return (
    <TelegramCallScreen
      visible
      status={status}
      name={peerName}
      callType={callType}
      timerLabel={timerLabel}
      connecting={status === "connected" && !lkToken}
      isMicMuted={isMicMuted}
      isCamOff={isCamOff}
      videoContent={videoSlot}
      onToggleMic={() => setIsMicMuted((v) => !v)}
      onToggleCam={() => setIsCamOff((v) => !v)}
      onAccept={() => void acceptCall()}
      onReject={rejectCall}
      onEnd={endCall}
    />
  );
}
