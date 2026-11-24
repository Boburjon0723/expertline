"use client";

import React, { useEffect, useRef, useState } from 'react';
import {
    LiveKitRoom,
    VideoConference,
    RoomAudioRenderer,
    ParticipantTile,
    TrackToggle,
    useTracks,
    useLocalParticipant,
    useRemoteParticipants,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track } from 'livekit-client';
import { apiFetch } from '@/lib/api';
import {
    LIVEKIT_AUDIO_CAPTURE,
    LIVEKIT_AUDIO_PUBLISH,
    LIVEKIT_AUDIO_PUBLISH_SPEECH,
    liveKitRoomOptions,
} from '@/lib/livekit-media';

interface LiveKitRoomWrapperProps {
    sessionId: string;
    onDisconnected: () => void;
    /** Ovozli chaqiruv: faqat audio, video yo'q */
    audioOnly?: boolean;
    /** Global call overlay mute holati */
    muted?: boolean;
    /** 1:1 qo'ng'iroq: qarshi tomon chiqib ketib qaytmasa chaqiriladi (qo'ng'iroqni yakunlash uchun) */
    onPeerLeft?: () => void;
    /** Oddiy 1:1 chat qo'ng'irog'i: ekran ulashish/chat/chiqish tugmalarisiz (ular overlayda). */
    plainCall?: boolean;
    /** plainCall: kichik (o'zingiz) oynaning pastdan masofasi, px — overlay tugmalari ustida tursin. */
    pipBottom?: number;
    /** Suhbatdosh ovozini o'chirish (karnay tugmasi). */
    soundOff?: boolean;
}

/**
 * 1:1 video qo'ng'iroq (Telegram uslubi): suhbatdosh to'liq ekranda, o'zingiz pastki o'ng burchakda
 * kichik oynada. Ekran ulashish/chat/chiqish yo'q — tugatish overlayda.
 */
function PlainCallVideo({ showMic, pipBottom }: { showMic: boolean; pipBottom: number }) {
    const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }], {
        onlySubscribed: false,
    });
    const local = tracks.find((t) => t.participant.isLocal);
    const remote = tracks.find((t) => !t.participant.isLocal);
    return (
        <div className="relative w-full h-full overflow-hidden">
            {remote ? (
                /* contain: telefonning tik videosi kompyuterda kesilmasdan, to'liq ko'rinsin. */
                <ParticipantTile
                    trackRef={remote}
                    className="!absolute inset-0 !rounded-none [&_video]:!object-contain [&_video]:!bg-[#0b0b14]"
                />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
                    Suhbatdosh kutilmoqda...
                </div>
            )}
            {local ? (
                <div
                    className="absolute right-4 z-[5] w-[28%] min-w-[120px] max-w-[240px] aspect-[3/4] sm:aspect-video rounded-xl overflow-hidden border border-white/20 shadow-2xl"
                    style={{ bottom: pipBottom }}
                >
                    <ParticipantTile trackRef={local} className="!rounded-none h-full" />
                </div>
            ) : null}
            <div className="absolute top-4 right-4 z-[6] flex gap-2">
                {showMic ? <TrackToggle source={Track.Source.Microphone} /> : null}
                <TrackToggle source={Track.Source.Camera} />
            </div>
        </div>
    );
}

/** Qarshi tomon xonadan chiqsa va shu vaqt ichida qaytmasa — qo'ng'iroq tugaydi (tarmoq uzilishiga imkon). */
const PEER_LEFT_GRACE_MS = 15_000;

function PeerLeftWatch({ onPeerLeft }: { onPeerLeft: () => void }) {
    const remotes = useRemoteParticipants();
    const seenPeer = useRef(false);
    const cb = useRef(onPeerLeft);
    cb.current = onPeerLeft;
    useEffect(() => {
        if (remotes.length > 0) {
            seenPeer.current = true;
            return;
        }
        if (!seenPeer.current) return;
        const id = setTimeout(() => cb.current(), PEER_LEFT_GRACE_MS);
        return () => clearTimeout(id);
    }, [remotes.length]);
    return null;
}

function MicSync({ muted, speech }: { muted?: boolean; speech?: boolean }) {
    const { localParticipant } = useLocalParticipant();
    useEffect(() => {
        if (!localParticipant || muted == null) return;
        const publish = speech ? LIVEKIT_AUDIO_PUBLISH_SPEECH : LIVEKIT_AUDIO_PUBLISH;
        void localParticipant.setMicrophoneEnabled(!muted, LIVEKIT_AUDIO_CAPTURE, publish);
    }, [localParticipant, muted, speech]);
    return null;
}

export default function LiveKitRoomWrapper({ sessionId, onDisconnected, audioOnly = false, muted, onPeerLeft, plainCall = false, pipBottom = 16, soundOff = false }: LiveKitRoomWrapperProps) {
    const [token, setToken] = useState("");
    const [wsUrl, setWsUrl] = useState("");

    useEffect(() => {
        const fetchToken = async () => {
            try {
                const response = await apiFetch(`/api/livekit/token?room=${sessionId}`);
                if (!response.ok) {
                    console.error("Failed to fetch LiveKit token");
                    return;
                }
                const data = await response.json();
                setToken(data.token);
                setWsUrl(data.wsUrl);
            } catch (e) {
                console.error("Error getting LiveKit token:", e);
            }
        };
        fetchToken();
    }, [sessionId]);

    if (token === "") {
        return <div className="text-white flex items-center justify-center w-full h-full">Ulanish kutilmoqda... (LiveKit)</div>;
    }

    return (
        <LiveKitRoom
            video={!audioOnly}
            audio={LIVEKIT_AUDIO_CAPTURE}
            token={token}
            serverUrl={wsUrl}
            options={liveKitRoomOptions(audioOnly ? 'speech' : 'call')}
            data-lk-theme="default"
            style={
                audioOnly ?
                    { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0, pointerEvents: 'none' }
                :   { height: '100%', width: '100%', backgroundColor: 'transparent' }
            }
            onDisconnected={onDisconnected}
        >
            <MicSync muted={muted} speech={audioOnly} />
            {onPeerLeft ? <PeerLeftWatch onPeerLeft={onPeerLeft} /> : null}
            {audioOnly ?
                <RoomAudioRenderer muted={soundOff} />
            :   <>
                    {plainCall ? <PlainCallVideo showMic={muted == null} pipBottom={pipBottom} /> : <VideoConference />}
                    <RoomAudioRenderer muted={soundOff} />
                </>
            }
        </LiveKitRoom>
    );
}
