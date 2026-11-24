import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FileText,
  Hand,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  PenTool,
  Video as VideoIcon,
  VideoOff,
  X,
} from "lucide-react-native";
import { useAuthLocale } from "../../auth/locale";
import { useAuthStore } from "../../auth/store";
import { AvatarImage } from "../../../components/AvatarImage";
import { apiFetch } from "../../../lib/api";
import { getSocket } from "../../../lib/socket";
import { getLiveKitTokenRequest } from "../service";
import { ensureCallMediaPermissions } from "../../../lib/call-media-permissions";
import {
  getLiveKitModules,
  startLiveKitAudioSession,
  stopLiveKitAudioSession,
} from "../../../lib/livekit-call-session";
import {
  LIVEKIT_AUDIO_CAPTURE,
  LIVEKIT_AUDIO_PUBLISH,
  liveKitRoomOptionsMobile,
} from "../../../lib/livekit-media";
import { downloadAndOpenWithSystemSheet } from "../../../lib/files";
import { StudentWhiteboard } from "./StudentWhiteboard";
import { useKeepAwake } from "expo-keep-awake";

function emitStudentMicOpen(sessionId: string, enabled: boolean) {
  const socket = getSocket();
  if (!socket || !sessionId) return;
  socket.emit("student_media_state", {
    sessionId: String(sessionId),
    type: "audio",
    enabled: !!enabled,
  });
}

function getLk() {
  return getLiveKitModules();
}

function lkRole(p: { metadata?: string } | undefined): "mentor" | "student" | null {
  if (!p?.metadata) return null;
  try {
    const meta = JSON.parse(p.metadata) as { lkRole?: string };
    if (meta.lkRole === "mentor") return "mentor";
    if (meta.lkRole === "student") return "student";
  } catch {
    /* ignore */
  }
  return null;
}

export type StudentSessionStyle = "mentor" | "consult" | "legal" | "psychology";

type Material = { id?: string; url: string; title: string; type?: string };
type Quiz = {
  id: number | string;
  title: string;
  isQuickPoll?: boolean;
  questions?: Array<{
    text?: string;
    question_text?: string;
    options?: Array<{ id?: string; label?: string; text?: string; option_text?: string; isCorrect?: boolean }>;
  }>;
};
type ChatLine = { id: string; text: string; sender: string; mine?: boolean };

function isScreenShareSource(source: unknown) {
  const Screen = getLk()?.LiveKitClient?.Track?.Source?.ScreenShare;
  return source === Screen || source === "screen_share" || String(source) === "screen_share";
}

function isCameraSource(source: unknown) {
  const Cam = getLk()?.LiveKitClient?.Track?.Source?.Camera;
  return source === Cam || source === "camera" || String(source) === "camera";
}

function hasPlayablePublication(t: any): boolean {
  if (!t) return false;
  const LiveKit = getLk()?.LiveKit;
  if (typeof LiveKit?.isTrackReference === "function" && LiveKit.isTrackReference(t)) {
    return !!t.publication?.track;
  }
  return !!(t.publication?.track || t.publication);
}

/** Remote audio/video/screen — avto-subscribe (mic/cam StudentMediaInner da) */
function StudentRoomBootstrap() {
  const mods = getLk()!;
  const LiveKit = mods.LiveKit;
  const LiveKitClient = mods.LiveKitClient;
  const room = LiveKit.useRoomContext();

  useEffect(() => {
    if (!room || !LiveKitClient) return;

    const subscribeAll = () => {
      room.remoteParticipants.forEach((p: any) => {
        p.trackPublications?.forEach((pub: any) => {
          if (pub?.setSubscribed && pub.isSubscribed === false) {
            try {
              pub.setSubscribed(true);
            } catch (e) {
              console.warn("[StudentPanel] subscribe", e);
            }
          }
        });
      });
    };

    const onPublished = (pub: any, participant: any) => {
      if (participant?.isLocal) return;
      if (pub?.setSubscribed && pub.isSubscribed === false) {
        try {
          pub.setSubscribed(true);
        } catch (e) {
          console.warn("[StudentPanel] subscribe pub", e);
        }
      }
    };

    subscribeAll();
    room.on(LiveKitClient.RoomEvent.TrackPublished, onPublished);
    room.on(LiveKitClient.RoomEvent.ParticipantConnected, subscribeAll);
    room.on(LiveKitClient.RoomEvent.Connected, subscribeAll);
    return () => {
      room.off(LiveKitClient.RoomEvent.TrackPublished, onPublished);
      room.off(LiveKitClient.RoomEvent.ParticipantConnected, subscribeAll);
      room.off(LiveKitClient.RoomEvent.Connected, subscribeAll);
    };
  }, [room, LiveKitClient]);

  return null;
}

function StudentAlbumView() {
  const mods = getLk()!;
  const LiveKit = mods.LiveKit;
  const LiveKitClient = mods.LiveKitClient;
  const tracks = LiveKit.useTracks(
    [
      { source: LiveKitClient.Track.Source.Camera, withPlaceholder: true },
      { source: LiveKitClient.Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const screenShare = tracks.find(
    (t: any) => isScreenShareSource(t.source) && !t.participant?.isLocal && hasPlayablePublication(t)
  );
  const mentorCam = tracks.find(
    (t: any) =>
      !t.participant?.isLocal &&
      isCameraSource(t.source) &&
      hasPlayablePublication(t) &&
      lkRole(t.participant) === "mentor"
  );
  const anyRemoteCam = tracks.find(
    (t: any) => !t.participant?.isLocal && isCameraSource(t.source) && hasPlayablePublication(t)
  );
  const localCam = tracks.find(
    (t: any) => t.participant?.isLocal && isCameraSource(t.source) && hasPlayablePublication(t)
  );
  const mainCam = mentorCam || anyRemoteCam;
  const stage = screenShare || mainCam;
  const mentorName = String(
    mainCam?.participant?.name ||
      (mainCam?.participant?.metadata
        ? (() => {
            try {
              return JSON.parse(mainCam.participant.metadata)?.displayName || "Ustoz";
            } catch {
              return "Ustoz";
            }
          })()
        : "Ustoz")
  );

  return (
    <View style={styles.videoGrid}>
      {stage && hasPlayablePublication(stage) ? (
        <LiveKit.VideoTrack
          trackRef={stage}
          style={styles.videoFillAbs}
          objectFit={screenShare ? "contain" : "cover"}
          zOrder={0}
        />
      ) : (
        <View style={styles.remotePlaceholder}>
          <AvatarImage name={mentorName} size={96} />
          <Text style={styles.remoteHint}>{mentorName}</Text>
        </View>
      )}
      {localCam && hasPlayablePublication(localCam) ? (
        <View style={styles.pip} pointerEvents="none">
          <LiveKit.VideoTrack trackRef={localCam} style={styles.videoFillAbs} objectFit="cover" zOrder={1} />
        </View>
      ) : null}
      {screenShare ? (
        <View style={styles.shareBadge}>
          <Text style={styles.shareBadgeText}>Ekran</Text>
        </View>
      ) : null}
    </View>
  );
}

function StudentMediaInner({ sessionId }: { sessionId: string }) {
  const LiveKit = getLk()!.LiveKit;
  const { localParticipant } = LiveKit.useLocalParticipant();
  const connectionState = LiveKit.useConnectionState();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const micNotifiedRef = useRef(false);

  useEffect(() => {
    if (!localParticipant || connectionState !== "connected") return;
    let cancelled = false;

    const sync = async () => {
      try {
        await localParticipant.setMicrophoneEnabled(
          micOn,
          LIVEKIT_AUDIO_CAPTURE,
          LIVEKIT_AUDIO_PUBLISH
        );
        if (!cancelled && micOn && !micNotifiedRef.current) {
          micNotifiedRef.current = true;
          emitStudentMicOpen(sessionId, true);
        }
        await localParticipant.setCameraEnabled(camOn);
      } catch (e) {
        if (!cancelled) console.warn("[StudentMedia]", e);
      }
    };

    void sync();
    // Track recreate qilmaslik: faqat birinchi marta ishlamasa bitta retry
    const retry = setTimeout(() => {
      if (cancelled) return;
      if (localParticipant.isMicrophoneEnabled === micOn) return;
      void sync();
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [localParticipant, connectionState, micOn, camOn, sessionId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !localParticipant) return;
    const onCmd = (p: { sessionId?: string; kind?: string; enabled?: boolean }) => {
      if (String(p?.sessionId) !== String(sessionId)) return;
      if (p.kind === "mic") {
        void localParticipant
          .setMicrophoneEnabled(!!p.enabled, LIVEKIT_AUDIO_CAPTURE, LIVEKIT_AUDIO_PUBLISH)
          .then(() => {
            setMicOn(!!p.enabled);
            emitStudentMicOpen(sessionId, !!p.enabled);
          });
      }
      if (p.kind === "cam" || p.kind === "camera" || p.kind === "video") {
        void localParticipant.setCameraEnabled(!!p.enabled).then(() => setCamOn(!!p.enabled));
      }
    };
    socket.on("mentor_media_command", onCmd);
    return () => {
      socket.off("mentor_media_command", onCmd);
    };
  }, [localParticipant, sessionId]);

  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    try {
      await localParticipant?.setMicrophoneEnabled(
        next,
        LIVEKIT_AUDIO_CAPTURE,
        LIVEKIT_AUDIO_PUBLISH
      );
      emitStudentMicOpen(sessionId, next);
    } catch (e) {
      console.warn("[StudentMedia] mic", e);
      setMicOn(!next);
    }
  };
  const toggleCam = async () => {
    const next = !camOn;
    setCamOn(next);
    try {
      await localParticipant?.setCameraEnabled(next);
    } catch (e) {
      console.warn("[StudentMedia] cam", e);
      setCamOn(!next);
    }
  };

  return (
    <View style={styles.mediaRow}>
      <Pressable onPress={() => void toggleMic()} style={[styles.roundBtn, !micOn && styles.roundBtnOff]}>
        {micOn ? <Mic color="#fff" size={20} /> : <MicOff color="#fff" size={20} />}
      </Pressable>
      <Pressable onPress={() => void toggleCam()} style={[styles.roundBtn, !camOn && styles.roundBtnOff]}>
        {camOn ? <VideoIcon color="#fff" size={20} /> : <VideoOff color="#fff" size={20} />}
      </Pressable>
    </View>
  );
}

export function StudentSessionScreen({
  visible,
  sessionId,
  sessionStyle = "mentor",
  onLeave,
}: {
  visible: boolean;
  sessionId: string;
  sessionStyle?: StudentSessionStyle;
  onLeave: () => void;
}) {
  // Dars davomida ekran o'chmasin/qulflanmasin.
  useKeepAwake("student-session");
  const { t } = useAuthLocale();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const isClassroom = sessionStyle === "mentor";

  const [token, setToken] = useState<string | null>(null);
  const [wsUrl, setWsUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<"none" | "materials" | "quizzes" | "chat">("none");
  const [showTools, setShowTools] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<number, string>>>({});
  const [chatLines, setChatLines] = useState<ChatLine[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [handRaised, setHandRaised] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const leftRef = useRef(false);
  const chatListRef = useRef<FlatList<ChatLine>>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef(panel);
  panelRef.current = panel;

  const pingChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (panelRef.current !== "none") return;
      setChromeVisible(false);
      setShowTools(false);
    }, 3000);
  }, []);

  useEffect(() => {
    pingChrome();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [visible, pingChrome]);

  useEffect(() => {
    if (panel !== "none") {
      setChromeVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      pingChrome();
    }
  }, [panel, pingChrome]);

  const leave = useCallback(() => {
    if (leftRef.current) return;
    leftRef.current = true;
    const socket = getSocket();
    if (socket && sessionId) socket.emit("session_leave", { sessionId });
    void stopLiveKitAudioSession();
    onLeave();
  }, [onLeave, sessionId]);

  useEffect(() => {
    if (!visible) {
      leftRef.current = false;
      setToken(null);
      setWsUrl(null);
      setLoading(true);
      setPanel("none");
      void stopLiveKitAudioSession();
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const ok = await ensureCallMediaPermissions("video");
        if (!ok) {
          if (!cancelled) {
            setLoading(false);
            leave();
          }
          return;
        }
        await startLiveKitAudioSession("speaker");
        const username = [user?.name, user?.surname].filter(Boolean).join(" ").trim() || "Talaba";
        const data = await getLiveKitTokenRequest(sessionId, username);
        if (!cancelled && data?.token && data?.wsUrl) {
          setToken(data.token);
          setWsUrl(data.wsUrl);
          console.log("[StudentPanel] LiveKit OK", sessionId, data.wsUrl);
        } else if (!cancelled) {
          Alert.alert("Xatolik", "Sessiyaga ulanishda xato");
          void stopLiveKitAudioSession();
        }
      } catch (e) {
        console.error("[StudentPanel] token", e);
        if (!cancelled) Alert.alert("Xatolik", e instanceof Error ? e.message : "Sessiyaga ulanishda xato");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, sessionId, user?.name, user?.surname]);

  useEffect(() => {
    if (!visible || !sessionId) return;
    const load = async () => {
      try {
        const resMat = await apiFetch(`/api/sessions/${sessionId}/materials?currentLesson=1`);
        if (resMat.ok) {
          const data = await resMat.json();
          setMaterials(
            Array.isArray(data)
              ? data.map((m: any) => ({
                  id: m.id,
                  url: m.url || m.file_url,
                  title: m.title,
                  type: m.type || m.file_type,
                }))
              : []
          );
        }
      } catch {
        /* ignore */
      }
      if (isClassroom) {
        try {
          const resQz = await apiFetch(`/api/sessions/${sessionId}/quizzes`);
          if (resQz.ok) {
            const data = await resQz.json();
            setQuizzes(Array.isArray(data) ? data : []);
          }
        } catch {
          /* ignore */
        }
      }
    };
    void load();
  }, [visible, sessionId, isClassroom]);

  useEffect(() => {
    if (!visible || !sessionId) return;

    const sameRoom = (a: unknown) =>
      String(a || "").trim().toLowerCase() === String(sessionId).trim().toLowerCase();

    const sidOk = (msg: any) => {
      const ids = [msg?.sessionId, msg?.session_id, msg?.roomId, msg?.chatId, msg?.chat_id].filter((v) => v != null);
      return ids.length === 0 || ids.some((v) => sameRoom(v));
    };

    const onMaterial = (data: any) => {
      const mat = data?.material ? data.material : data;
      if (data?.sessionId != null && !sameRoom(data.sessionId) && data?.material) return;
      if (!mat || (!mat.url && !mat.file_url && !mat.title)) return;
      setMaterials((p) => [
        ...p,
        {
          id: mat.id,
          url: mat.url || mat.file_url,
          title: mat.title || "Material",
          type: mat.type || mat.file_type,
        },
      ]);
      setBanner("Yangi material");
    };
    const onQuiz = (data: { sessionId?: string; quizDetails?: Quiz & { isQuickPoll?: boolean } }) => {
      if (!isClassroom || !sidOk(data)) return;
      const details = data.quizDetails;
      if (!details) return;
      if (details.isQuickPoll) {
        setQuizzes((p) => (p.some((q) => String(q.id) === String(details.id)) ? p : [...p, details]));
        setPanel("quizzes");
        setBanner("Tezkor so'rov");
        return;
      }
      setQuizzes((p) => (p.some((q) => String(q.id) === String(details.id)) ? p : [...p, details]));
      setPanel("quizzes");
      setBanner(`Yangi viktorina: ${details.title || ""}`);
    };
    const onWb = (data: boolean | { isOpen?: boolean; sessionId?: string }) => {
      if (typeof data === "object" && data?.sessionId != null && !sameRoom(data.sessionId)) return;
      const isOpen = typeof data === "boolean" ? data : !!data?.isOpen;
      setWhiteboardOpen(isOpen);
      if (isOpen) setBanner("Doska ochiq");
    };
    const onKicked = (data: { sessionId: string }) => {
      if (!sameRoom(data.sessionId)) return;
      Alert.alert("", t("studentPanelKicked"));
      leave();
    };
    const onEnded = (data: { sessionId?: string }) => {
      if (data?.sessionId != null && !sameRoom(data.sessionId)) return;
      Alert.alert("", t("studentPanelLessonEnded"));
      leave();
    };
    const onWbDraw = () => setWhiteboardOpen(true);
    const onHand = (data: { studentId?: string }) => {
      if (data?.studentId != null && String(data.studentId) === String(user?.id)) setHandRaised(false);
    };
    const onChat = (msg: any) => {
      if (!sidOk(msg)) return;
      const text = String(msg.content || msg.text || "").trim();
      if (!text) return;
      const senderId = String(msg.senderId || msg.userId || msg.sender_id || "");
      const line: ChatLine = {
        id: String(msg.id || msg.clientSideId || `${Date.now()}-${Math.random()}`),
        text,
        sender: String(msg.sender_name || msg.sender || "Ustoz"),
        mine: senderId !== "" && senderId === String(user?.id || ""),
      };
      setChatLines((p) => (p.some((x) => x.id === line.id) ? p : [...p, line]));
    };

    let attached: ReturnType<typeof getSocket> = null;
    const join = (s: NonNullable<ReturnType<typeof getSocket>>) => {
      s.emit("join_room", sessionId);
      s.emit("session_join", { sessionId });
    };
    const bind = (s: NonNullable<ReturnType<typeof getSocket>>) => {
      s.on("material_uploaded", onMaterial);
      s.on("material_new", onMaterial);
      s.on("quiz_start", onQuiz);
      s.on("quiz_active", onQuiz);
      s.on("whiteboard:toggle", onWb);
      s.on("whiteboard:draw", onWbDraw);
      s.on("student_kicked", onKicked);
      s.on("lesson_ended", onEnded);
      s.on("hand_lowered", onHand);
      s.on("session_chat:receive", onChat);
      s.on("receive_message", onChat);
    };
    const unbind = (s: NonNullable<ReturnType<typeof getSocket>>) => {
      s.off("material_uploaded", onMaterial);
      s.off("material_new", onMaterial);
      s.off("quiz_start", onQuiz);
      s.off("quiz_active", onQuiz);
      s.off("whiteboard:toggle", onWb);
      s.off("whiteboard:draw", onWbDraw);
      s.off("student_kicked", onKicked);
      s.off("lesson_ended", onEnded);
      s.off("hand_lowered", onHand);
      s.off("session_chat:receive", onChat);
      s.off("receive_message", onChat);
      s.emit("session_leave", { sessionId });
    };

    const attach = () => {
      const s = getSocket();
      if (!s?.connected) return;
      if (attached === s) {
        join(s);
        return;
      }
      if (attached) unbind(attached);
      attached = s;
      join(s);
      bind(s);
    };

    attach();
    const poll = setInterval(attach, 2000);
    return () => {
      clearInterval(poll);
      if (attached) unbind(attached);
    };
  }, [visible, sessionId, isClassroom, leave, t, user?.id]);

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 8000);
    return () => clearTimeout(id);
  }, [banner]);

  const toggleHand = () => {
    const socket = getSocket();
    if (!socket) return;
    if (handRaised) {
      socket.emit("student_lower_hand", { sessionId });
      setHandRaised(false);
    } else {
      socket.emit("student_raise_hand", { sessionId });
      setHandRaised(true);
    }
  };

  const sendChat = () => {
    const text = chatInput.trim();
    const socket = getSocket();
    if (!text || !socket) return;
    const clientSideId = `local-${Date.now()}`;
    setChatLines((p) => [
      ...p,
      { id: clientSideId, text, sender: user?.name || t("studentPanelRole"), mine: true },
    ]);
    socket.emit("session_chat:send", { sessionId, content: text, type: "text", clientSideId });
    setChatInput("");
  };

  const submitQuiz = (quiz: Quiz) => {
    const answers = quizAnswers[String(quiz.id)];
    if (!answers || Object.keys(answers).length === 0) {
      setBanner("Javobni tanlang, keyin yuboring");
      return;
    }
    const socket = getSocket();
    if (!socket) return;
    let score: number | undefined;
    if (!quiz.isQuickPoll && quiz.questions) {
      score = 0;
      quiz.questions.forEach((q, qIdx) => {
        const selectedId = answers[qIdx];
        const opt = q.options?.find((o, oi) => String(o.id ?? oi) === String(selectedId));
        if (opt?.isCorrect) score! += 1;
      });
    }
    const payload = {
      sessionId,
      quizId: quiz.id,
      studentId: user?.id,
      answers,
      ...(score !== undefined ? { score } : {}),
    };
    socket.emit("quiz_submit", payload);
    if (quiz.isQuickPoll) {
      socket.emit("quiz_answer", payload);
    }
    setQuizzes((p) => {
      const next = p.filter((q) => String(q.id) !== String(quiz.id));
      if (next.length === 0) setPanel("none");
      return next;
    });
    setBanner(quiz.isQuickPoll ? "Javob yuborildi" : null);
  };

  const openMaterial = async (mat: Material) => {
    if (!mat.url) return;
    try {
      await downloadAndOpenWithSystemSheet(mat.url, mat.title);
    } catch {
      await Linking.openURL(mat.url).catch(() => {});
    }
  };

  if (!visible) return null;

  const albumFallback = (
    <View style={styles.videoGrid}>
      <View style={styles.remotePlaceholder}>
        <AvatarImage name={user?.name || t("studentPanelRole")} size={120} uri={user?.avatar_url || user?.avatar} />
        {loading ? <ActivityIndicator color="#38bdf8" style={{ marginTop: 16 }} /> : null}
      </View>
    </View>
  );

  const board =
    whiteboardOpen ? (
      <View style={styles.boardLayer} pointerEvents="auto">
        <StudentWhiteboard
          sessionId={sessionId}
          userId={user?.id != null ? String(user.id) : undefined}
          showToolbar={chromeVisible}
          onActivity={pingChrome}
        />
      </View>
    ) : null;

  const chrome = (withMedia: boolean) => (
    <>
      {!chromeVisible && !whiteboardOpen ? (
        <Pressable style={styles.tapCatch} onPress={pingChrome} />
      ) : null}
      {chromeVisible && !getLk() ? (
        <View style={styles.devHint} pointerEvents="none">
          <Text style={styles.devHintText}>Video/screen: dev build</Text>
        </View>
      ) : null}
      {chromeVisible && banner ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{banner}</Text>
          <Pressable onPress={() => setBanner(null)} hitSlop={8}>
            <X color="#e0f2fe" size={16} />
          </Pressable>
        </View>
      ) : null}

      {chromeVisible ? (
      <View style={styles.chrome} pointerEvents="box-none" onTouchStart={pingChrome}>
        <View style={styles.whoChip}>
          <AvatarImage name={user?.name || t("studentPanelRole")} size={28} uri={user?.avatar_url || user?.avatar} />
          <View>
            <Text style={styles.roleLabel}>{t("studentPanelRole")}</Text>
            <Text style={styles.whoName} numberOfLines={1}>
              {user?.name || t("studentPanelRole")}
            </Text>
          </View>
        </View>
        <View style={styles.topRight}>
          <Pressable onPress={() => setShowTools((v) => !v)} style={styles.menuBtn}>
            <Menu color="#fff" size={18} />
          </Pressable>
          <Pressable onPress={leave} style={styles.exitBtn}>
            <LogOut color="#fecaca" size={16} />
            <Text style={styles.exitBtnText}>{t("studentPanelExit")}</Text>
          </Pressable>
        </View>

        {withMedia ? (
          <View style={styles.mediaFloat}>
            <StudentMediaInner sessionId={sessionId} />
          </View>
        ) : null}

        {showTools ? (
          <View style={styles.dock} pointerEvents="box-none">
            {isClassroom ? (
              <Pressable onPress={toggleHand} style={[styles.dockBtn, handRaised && styles.dockBtnOn]}>
                <Hand color="#fff" size={16} />
                <Text style={styles.dockLbl}>
                  {handRaised ? t("studentPanelLowerHand") : t("studentPanelRaiseHand")}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setPanel(panel === "materials" ? "none" : "materials")}
              style={[styles.dockBtn, panel === "materials" && styles.dockBtnOn]}
            >
              <FileText color="#fff" size={16} />
              <Text style={styles.dockLbl}>{t("studentPanelMaterials")}</Text>
            </Pressable>
            {isClassroom ? (
              <Pressable
                onPress={() => setPanel(panel === "quizzes" ? "none" : "quizzes")}
                style={[styles.dockBtn, panel === "quizzes" && styles.dockBtnOn]}
              >
                <PenTool color="#fff" size={16} />
                <Text style={styles.dockLbl}>{t("studentPanelQuizzes")}</Text>
              </Pressable>
            ) : null}
            {isClassroom ? (
              <Pressable
                onPress={() => setPanel(panel === "chat" ? "none" : "chat")}
                style={[styles.dockBtn, panel === "chat" && styles.dockBtnOn]}
              >
                <MessageSquare color="#fff" size={16} />
                <Text style={styles.dockLbl}>{t("studentPanelChat")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      ) : null}

            {panel !== "none" ? (
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                style={[
                  styles.sheet,
                  panel === "quizzes" && styles.sheetQuiz,
                  { bottom: Math.max(insets.bottom, 10) },
                ]}
              >
                <View style={styles.sheetHead}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {panel === "materials"
                      ? t("studentPanelMaterials")
                      : panel === "quizzes"
                        ? t("studentPanelQuizzes")
                        : t("studentPanelChat")}
                  </Text>
                  <Pressable onPress={() => setPanel("none")} hitSlop={10}>
                    <X color="#fff" size={16} />
                  </Pressable>
                </View>
                {panel === "materials" ? (
                  <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
                    {materials.length === 0 ? (
                      <Text style={styles.empty}>{t("studentPanelNoMaterials")}</Text>
                    ) : (
                      materials.map((m, i) => (
                        <Pressable key={String(m.id || i)} onPress={() => void openMaterial(m)} style={styles.matRow}>
                          <FileText color="#7dd3fc" size={16} />
                          <Text style={styles.matTitle} numberOfLines={2}>{m.title}</Text>
                        </Pressable>
                      ))
                    )}
                  </ScrollView>
                ) : null}
                {panel === "quizzes" ? (
                  <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
                    {quizzes.length === 0 ? (
                      <Text style={styles.empty}>{t("studentPanelNoQuizzes")}</Text>
                    ) : (
                      quizzes.map((quiz) => (
                        <View key={String(quiz.id)} style={styles.quizCard}>
                          <Text style={styles.quizTitle} numberOfLines={2}>{quiz.title}</Text>
                          {(quiz.questions || []).map((q, qi) => (
                            <View key={qi} style={styles.qBlock}>
                              <Text style={styles.qText}>{q.text || q.question_text}</Text>
                              {(q.options || []).map((opt, oi) => {
                                const optId = String(opt.id ?? oi);
                                const sel = quizAnswers[String(quiz.id)]?.[qi] === optId;
                                return (
                                  <Pressable
                                    key={optId}
                                    onPress={() =>
                                      setQuizAnswers((prev) => ({
                                        ...prev,
                                        [String(quiz.id)]: { ...(prev[String(quiz.id)] || {}), [qi]: optId },
                                      }))
                                    }
                                    style={[styles.opt, sel && styles.optSel]}
                                  >
                                    <View style={[styles.optDot, sel && styles.optDotOn]} />
                                    <Text style={styles.optText}>{opt.label || opt.text || opt.option_text}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          ))}
                          <Pressable onPress={() => submitQuiz(quiz)} style={styles.submitQuiz}>
                            <Text style={styles.submitQuizText}>{t("studentPanelSubmitQuiz")}</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </ScrollView>
                ) : null}
                {panel === "chat" ? (
                  <>
                    <FlatList
                      data={chatLines}
                      keyExtractor={(it) => it.id}
                      contentContainerStyle={styles.chatList}
                      ListEmptyComponent={<Text style={styles.empty}>{t("studentPanelNoChat")}</Text>}
                      onContentSizeChange={() => {
                        chatListRef.current?.scrollToEnd({ animated: true });
                      }}
                      ref={chatListRef}
                      renderItem={({ item }) => (
                        <View style={[styles.chatBubble, item.mine && styles.chatBubbleMine]}>
                          {item.mine ? null : <Text style={styles.chatSender}>{item.sender}</Text>}
                          <Text style={styles.chatText}>{item.text}</Text>
                        </View>
                      )}
                    />
                    <View style={styles.chatInputRow}>
                      <TextInput
                        value={chatInput}
                        onChangeText={setChatInput}
                        placeholder={t("studentPanelChat")}
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        style={styles.chatInput}
                        returnKeyType="send"
                        onSubmitEditing={sendChat}
                        blurOnSubmit={false}
                      />
                      <Pressable onPress={sendChat} style={styles.sendChat}>
                        <Text style={styles.sendChatText}>OK</Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </KeyboardAvoidingView>
            ) : null}
    </>
  );

  const LiveKit = getLk()?.LiveKit;
  return (
    <View style={styles.root} pointerEvents={visible ? "auto" : "none"}>
      {token && wsUrl && LiveKit ? (
        <LiveKit.LiveKitRoom
          key={`${sessionId}:${token.slice(0, 12)}`}
          token={token}
          serverUrl={wsUrl}
          connect={true}
          audio={false}
          video={false}
          options={liveKitRoomOptionsMobile("panel")}
          onError={(e: unknown) => {
            console.error("[StudentPanel] LiveKit", e);
            Alert.alert("LiveKit", e instanceof Error ? e.message : "Ulanish xatosi");
          }}
        >
          <View style={styles.roomFill}>
            <StudentRoomBootstrap />
            <StudentAlbumView />
            {board}
            {chrome(true)}
          </View>
        </LiveKit.LiveKitRoom>
      ) : (
        <>
          {albumFallback}
          {board}
          {chrome(false)}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#03040a",
    zIndex: 200,
    elevation: 200,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "rgba(255,255,255,0.75)", fontSize: 14 },
  exitGhost: { marginTop: 8, padding: 10 },
  exitGhostText: { color: "#93c5fd", fontWeight: "700" },
  videoGrid: { ...StyleSheet.absoluteFillObject, zIndex: 0 },
  videoFill: { flex: 1, width: "100%", height: "100%" },
  videoFillAbs: { ...StyleSheet.absoluteFillObject },
  roomFill: { ...StyleSheet.absoluteFillObject },
  boardLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: "#0f172a",
  },
  chrome: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    elevation: 80,
  },
  tapCatch: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 78,
    elevation: 78,
  },
  whoChip: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 81,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(8,12,22,0.55)",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  topRight: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 81,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  devHint: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    zIndex: 70,
    backgroundColor: "rgba(15,23,42,0.65)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  devHintText: { color: "#fde68a", fontSize: 10, textAlign: "center" },
  mediaFloat: {
    position: "absolute",
    left: 10,
    bottom: 12,
    zIndex: 82,
  },
  remoteBox: { flex: 1, backgroundColor: "#0b1220", position: "relative" },
  remotePlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b1220" },
  remoteHint: { color: "rgba(255,255,255,0.7)", marginTop: 12, fontWeight: "700" },
  localPreview: {
    width: "28%",
    backgroundColor: "#111827",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  camOff: { flex: 1, alignItems: "center", justifyContent: "center" },
  shareBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(14,165,233,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shareBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  roleLabel: { color: "#38bdf8", fontSize: 9, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  whoName: { color: "#fff", fontSize: 12, fontWeight: "700", maxWidth: 120 },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(8,12,22,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  pip: {
    position: "absolute",
    right: 12,
    bottom: 16,
    width: 120,
    height: 80,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    zIndex: 20,
  },
  exitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(239,68,68,0.2)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  exitBtnText: { color: "#fecaca", fontSize: 11, fontWeight: "800" },
  notice: {
    position: "absolute",
    top: 48,
    alignSelf: "center",
    maxWidth: "70%",
    zIndex: 75,
    backgroundColor: "rgba(15,23,42,0.88)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.35)",
  },
  noticeText: { color: "#e0f2fe", flex: 1, fontSize: 12 },
  wbBanner: {
    position: "absolute",
    top: 56,
    alignSelf: "center",
    backgroundColor: "rgba(124,58,237,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  wbBannerText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  dock: {
    position: "absolute",
    top: 52,
    left: 20,
    zIndex: 82,
    flexDirection: "column",
    alignItems: "stretch",
    gap: 6,
  },
  mediaRow: { flexDirection: "row", gap: 6 },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(8,12,22,0.62)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnOff: { backgroundColor: "#ef4444" },
  dockBtn: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 64,
    borderRadius: 12,
    backgroundColor: "rgba(8,12,22,0.62)",
  },
  dockBtnOn: { backgroundColor: "rgba(56,189,248,0.45)" },
  dockLbl: { color: "#fff", fontSize: 8, fontWeight: "700" },
  sheet: {
    position: "absolute",
    top: 48,
    right: 8,
    width: 280,
    maxWidth: "42%",
    backgroundColor: "rgba(8,12,22,0.94)",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    zIndex: 85,
    elevation: 85,
  },
  sheetQuiz: { width: 300, maxWidth: "46%" },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  sheetTitle: { color: "#fff", fontSize: 13, fontWeight: "800", flex: 1, marginRight: 8 },
  sheetBody: { padding: 8, paddingBottom: 16 },
  chatList: { paddingHorizontal: 8, paddingVertical: 8, flexGrow: 1 },
  empty: { color: "rgba(255,255,255,0.4)", textAlign: "center", marginTop: 16, fontSize: 12 },
  matRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 6,
  },
  matTitle: { color: "#fff", flex: 1, fontWeight: "600", fontSize: 13 },
  quizCard: { marginBottom: 10 },
  quizTitle: { color: "#fff", fontSize: 13, fontWeight: "800" },
  qBlock: { marginTop: 8 },
  qText: { color: "rgba(255,255,255,0.88)", marginBottom: 6, fontSize: 12, fontWeight: "600" },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    marginBottom: 4,
  },
  optSel: { borderColor: "#38bdf8", backgroundColor: "rgba(56,189,248,0.18)" },
  optDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.35)",
  },
  optDotOn: { backgroundColor: "#38bdf8", borderColor: "#38bdf8" },
  optText: { color: "#fff", fontSize: 12, flex: 1 },
  submitQuiz: {
    marginTop: 8,
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  submitQuizText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  chatBubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    marginBottom: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
  },
  chatBubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(14,165,233,0.28)",
  },
  chatSender: { color: "#7dd3fc", fontSize: 10, fontWeight: "700", marginBottom: 2 },
  chatText: { color: "#fff", fontSize: 13 },
  chatInputRow: {
    flexDirection: "row",
    gap: 6,
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  sendChat: { backgroundColor: "#0284c7", borderRadius: 10, paddingHorizontal: 12, justifyContent: "center" },
  sendChatText: { color: "#fff", fontWeight: "800", fontSize: 12 },
});
