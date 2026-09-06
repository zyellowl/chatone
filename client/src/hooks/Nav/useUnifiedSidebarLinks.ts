import { MessagesSquare } from 'lucide-react';
import type { NavLink } from '~/common';
import ConversationsSection from '~/components/UnifiedSidebar/ConversationsSection';

export default function useUnifiedSidebarLinks() {
  const conversationLink: NavLink = {
    title: 'com_ui_chat_history',
    label: '',
    icon: MessagesSquare,
    id: 'conversations',
    Component: ConversationsSection,
  };

  return [conversationLink];
}
