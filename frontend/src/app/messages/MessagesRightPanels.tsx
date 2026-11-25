'use client';

import React from 'react';
import ChannelInfoPanel from '@/components/chat/ChannelInfoPanel';
import UserInfoPanel from '@/components/chat/UserInfoPanel';
import GroupInfoPanel from '@/components/chat/GroupInfoPanel';

export type MessagesRightPanelsProps = {
    showRightPanel: boolean;
    selectedChat: any;
    onCloseRightPanel: () => void;
    onChatDeleted: () => void;
    onChatLeft: () => void;
    onGroupUpdated: () => void;
    onChatNotFound: () => void;
};

export function MessagesRightPanels({
    showRightPanel,
    selectedChat,
    onCloseRightPanel,
    onChatDeleted,
    onChatLeft,
    onGroupUpdated,
    onChatNotFound,
}: MessagesRightPanelsProps) {
    return (
        <>
            {selectedChat ? (
                <aside
                    aria-hidden={!showRightPanel}
                    className={[
                        'fixed lg:relative inset-0 lg:inset-auto z-[200] lg:z-0 h-full min-h-0 w-80 flex-shrink-0 overflow-hidden isolate max-lg:w-full bg-[#212121] lg:rounded-[24px] lg:shadow-[0_0_4px_0_rgba(0,0,0,0.24)]',
                        showRightPanel ? 'flex flex-col chat-info-panel-enter' : 'hidden',
                    ].join(' ')}
                >
                    {selectedChat?.type === 'channel' ? (
                        <ChannelInfoPanel chat={selectedChat} onClose={onCloseRightPanel} onLeft={onChatLeft} onDeleted={onChatDeleted} onGroupUpdated={onGroupUpdated} />
                    ) : selectedChat?.type === 'private' ? (
                        <UserInfoPanel chat={selectedChat} onClose={onCloseRightPanel} />
                    ) : (
                        <GroupInfoPanel
                            chat={selectedChat}
                            onClose={onCloseRightPanel}
                            onDeleted={onChatDeleted}
                            onLeft={onChatLeft}
                            onGroupUpdated={onGroupUpdated}
                            onChatNotFound={onChatNotFound}
                        />
                    )}
                </aside>
            ) : null}
        </>
    );
}

export default MessagesRightPanels;
