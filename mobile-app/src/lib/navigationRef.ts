import { createNavigationContainerRef } from '@react-navigation/native';

type RootStackParamList = {
  ChatDetail: {
    chatId: string;
    name: string;
    avatarUrl?: string | null;
    startCall?: "audio" | "video";
    focusMessageId?: string;
  };
};

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Ekran kodi oynasi ochiqmi — ustiga boshqa sahifa ochib, qulfni chetlab o'tmaslik uchun. */
export function isAppLocked(): boolean {
  if (!navigationRef.isReady()) return false;
  return (navigationRef.getCurrentRoute()?.name as string | undefined) === 'Passcode';
}

export function navigateToChatFromNotification(chatId: string, name = 'Chat') {
  if (!navigationRef.isReady() || isAppLocked()) return;
  navigationRef.navigate('ChatDetail', {
    chatId: String(chatId),
    name,
    avatarUrl: null,
  });
}
