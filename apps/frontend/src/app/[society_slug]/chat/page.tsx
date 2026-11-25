'use client';

import { useAuth } from '../../providers/auth-context';
import { ChatView } from '@/components/chat/chat-view';

export default function ChatPage() {
  const { activeSociety } = useAuth();
  return <ChatView key={activeSociety?.societyId} />;
}
