"use client";

import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  User, 
  Search, 
  CheckCheck, 
  Loader2,
  Inbox,
  Filter,
  MessageCircle,
  MoreVertical,
  ImageIcon,
  Image as ImgIcon
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { getPusherClient } from "@/lib/pusher";
import { nanoid } from "nanoid";

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [convLoading, setConvLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Polling des conversations
  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  // Polling des messages de l'utilisateur sélectionné
  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
      
      const pusher = getPusherClient();
      // On garde un polling de sécurité robuste
      const interval = setInterval(() => fetchMessages(selectedUser.id), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedUser?.id]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchConversations = async () => {
    try {
      // Nous utilisons l'API d'administration pour lister les utilisateurs
      const res = await fetch("/api/users"); 
      const users = await res.json();
      
      // On filtre les candidats (role USER)
      setConversations(users.filter((u: any) => u.role === "USER")); 
    } catch (err) {} finally {
      setConvLoading(false);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const res = await fetch(`/api/chat?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {}
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser || isSending) return;

    setIsSending(true);
    const tempId = nanoid();
    const optimisticMsg = {
        id: tempId,
        content: newMessage,
        senderRole: "ADMIN",
        senderId: "ADMIN_SYSTEM",
        createdAt: new Date().toISOString(),
        attachments: []
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            content: optimisticMsg.content, 
            userId: selectedUser.id,
            attachments: []
        }),
      });
      if (res.ok) {
        const finalMsg = await res.json();
        setMessages(prev => prev.map(m => m.id === tempId ? finalMsg : m));
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        const errorData = await res.json();
        toast.error(errorData.error || errorData.details || "Échec de l'envoi");
      }
    } catch (err) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      toast.error("Erreur de connexion");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Sidebar de conversations */}
      <div className="w-80 md:w-96 border-r bg-white flex flex-col shrink-0">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Inbox className="w-5 h-5 text-blue-600" />
                Messages
            </h2>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <Input 
                placeholder="Rechercher un candidat..." 
                className="pl-10 h-10 border-slate-100 bg-slate-50 text-xs rounded-xl"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {convLoading ? (
            <div className="p-8 text-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                <p className="text-xs font-bold">Chargement...</p>
            </div>
          ) : (
            conversations.map((user) => (
              <button
                key={user.id}
                onClick={() => setSelectedUser(user)}
                className={`w-full p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors border-b border-slate-50 relative ${
                    selectedUser?.id === user.id ? 'bg-blue-50/50' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 font-bold border border-white shadow-sm ring-2 ring-transparent group-hover:ring-blue-100 transition-all">
                  {user.name?.charAt(0) || <User className="w-5 h-5" />}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className="font-black text-slate-900 text-xs truncate uppercase tracking-tight">{user.name}</p>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate font-medium">{user.email}</p>
                </div>
                {selectedUser?.id === user.id && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-blue-600 rounded-full" />
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Zone de discussion */}
      <div className="flex-1 bg-slate-50 flex flex-col relative overflow-hidden">
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="bg-white border-b h-20 flex items-center justify-between px-8 shadow-sm z-10 shrink-0">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    {selectedUser.name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                        {selectedUser.name}
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2 py-0.5 text-[8px] uppercase">En ligne</Badge>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedUser.email}</p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="rounded-xl">
                    <MoreVertical className="w-5 h-5 text-slate-400" />
                  </Button>
               </div>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 space-y-6">
               {messages.map((m) => {
                 const isMe = m.senderRole === "ADMIN";
                 return (
                   <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                      <div className={`max-w-[70%] group`}>
                         <div className={`p-4 rounded-3xl relative shadow-sm ${
                           isMe ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none border border-slate-100'
                         }`}>
                           {m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0 && (
                             <div className="mb-3 rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                               {m.attachments.map((url: string, idx: number) => (
                                 <img key={idx} src={url} alt="Attachment" className="max-w-full h-auto object-cover hover:scale-[1.02] transition-transform" />
                               ))}
                             </div>
                           )}
                           <p className="text-sm leading-relaxed font-medium">{m.content}</p>
                         </div>
                         <div className={`flex items-center gap-2 mt-2 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <p className="text-[9px] font-black text-slate-400 uppercase">
                                {format(new Date(m.createdAt), 'HH:mm', { locale: fr })}
                            </p>
                            {isMe && <CheckCheck className={`w-3 h-3 ${m.isRead ? 'text-blue-500' : 'text-slate-300'}`} />}
                         </div>
                      </div>
                   </div>
                 );
               })}
            </div>

            {/* Input Area */}
            <div className="bg-white border-t p-6 pb-8 shrink-0">
               <form onSubmit={handleSendMessage} className="flex items-center gap-4 max-w-4xl mx-auto">
                  <Input 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez un message direct au candidat..."
                    className="flex-1 h-14 rounded-2xl border-slate-100 bg-slate-50 px-6 text-sm focus:ring-blue-100"
                    disabled={isSending}
                  />
                  <Button 
                    type="submit" 
                    disabled={isSending || !newMessage.trim()}
                    className="h-14 w-14 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all flex justify-center items-center"
                  >
                    {isSending ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                  </Button>
               </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-white/50 backdrop-blur-xl">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 ring-8 ring-blue-50/50">
                <MessageCircle className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">Messagerie d'Assistance</h3>
            <p className="text-slate-500 font-medium max-w-sm mt-2">
                Sélectionnez un candidat dans la colonne de gauche pour démarrer une discussion instantanée.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
