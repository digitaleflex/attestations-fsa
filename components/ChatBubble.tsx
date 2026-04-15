"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageCircle,
  X,
  Send,
  User,
  Building,
  Loader2,
  Minimize2,
  Maximize2,
  Camera,
  Image as ImageIcon
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { getPusherClient } from "@/lib/pusher";
import { nanoid } from "nanoid";

export default function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMessages();

      const pusher = getPusherClient();
      // On garde un polling de sécurité (mode dégradé robuste)
      const interval = setInterval(fetchMessages, 4000);
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messages.length > 0) {
        const userId = messages.find(m => m.userId)?.userId;
        if (userId) {
            const pusher = getPusherClient();
            const channel = pusher.subscribe(`chat-${userId}`);

            channel.bind("message", (newMsg: any) => {
                setMessages(prev => {
                    // Éviter les doublons (optimistic vs real)
                    if (prev.some(m => m.id === newMsg.id)) return prev;
                    return [...prev, newMsg];
                });
            });

            return () => {
                pusher.unsubscribe(`chat-${userId}`);
            };
        }
    }
  }, [isOpen, messages.length === 0]);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isMinimized]);

  const fetchMessages = async () => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error("Chat fetch error:", err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;

    const tempId = nanoid();
    const optimisticMsg = {
        id: tempId,
        content: newMessage,
        senderRole: "user",
        senderId: "temp",
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
            attachments: []
        }),
      });
      if (res.ok) {
        const finalMsg = await res.json();
        // Remplacer le message optimiste par le vrai
        setMessages(prev => prev.map(m => m.id === tempId ? finalMsg : m));
      } else {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        const errorData = await res.json();
        toast.error(errorData.error || errorData.details || "Échec de l'envoi");
      }
    } catch (err) {
        setMessages(prev => prev.filter(m => m.id !== tempId));
        console.error("Chat send error:", err);
        toast.error("Vérifiez votre connexion internet.");
    } finally {
        // isLoading n'est plus utile pour bloquer l'UI grâce à l'optimisme
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-slate-900 text-white rounded-full flex items-center justify-center shadow-2xl hover:scale-110 active:scale-95 transition-all z-50 group border-4 border-white"
      >
        <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        {messages.some(m => m.senderRole === "admin" && !m.isRead) && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full border-2 border-white animate-bounce" />
        )}
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${isMinimized ? 'h-14 w-64' : 'h-[500px] w-80 md:w-96'}`}>
      <Card className="h-full flex flex-col shadow-2xl border-slate-100 overflow-hidden bg-white/95 backdrop-blur-sm">
        {/* Header */}
        <div className="bg-slate-900 p-4 flex items-center justify-between text-white shadow-lg">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-blue-500/20">
                <Building className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-black tracking-tight leading-none mb-0.5">Assistance Centrale</p>
                <div className="flex items-center gap-1.5 opacity-60">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">Agents en ligne</span>
                </div>
              </div>
           </div>
           <div className="flex items-center gap-1">
             <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
             </button>
             <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
             </button>
           </div>
        </div>

        {!isMinimized && (
            <>
                {/* Messages List */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border-dashed border-2 border-slate-100 mt-2">
                             <MessageCircle className="w-8 h-8 text-slate-300 mb-2" />
                             <p className="text-xs font-bold text-slate-500">Posez votre question à nos assistants.</p>
                             <p className="text-[10px] text-slate-400 mt-1">Nous sommes là pour vous aider en temps réel.</p>
                        </div>
                    ) : (
                        messages.map((m, i) => {
                            const isMe = m.senderRole === "user";
                            return (
                                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm relative ${
                                        isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-100 text-slate-800 rounded-bl-none'
                                    }`}>
                                        {m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0 && (
                                            <div className="mb-2 rounded-lg overflow-hidden border border-white/20">
                                                {m.attachments.map((url: string, idx: number) => (
                                                    <img key={idx} src={url} alt="Attachment" className="max-w-full h-auto object-cover hover:scale-105 transition-transform" />
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-xs leading-relaxed font-medium">{m.content}</p>
                                        <p className={`text-[8px] mt-1.5 font-bold uppercase ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                            {format(new Date(m.createdAt), 'HH:mm', { locale: fr })}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Input */}
                <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex items-center gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 rounded-xl text-slate-400"
                        onClick={() => {
                            const url = prompt("Lien de l'image ou capture :");
                            if (url) {
                                fetch("/api/chat", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ content: "Capture d'écran jointe", attachments: [url] }),
                                }).then(() => fetchMessages());
                            }
                        }}
                    >
                        <ImageIcon className="w-4 h-4" />
                    </Button>
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Écrivez un message..."
                        className="h-11 rounded-xl border-slate-100 bg-slate-50 text-xs focus:ring-blue-100"
                        disabled={isLoading}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        className="h-11 w-11 rounded-xl bg-slate-900 group shadow-lg"
                        disabled={isLoading || !newMessage.trim()}
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />}
                    </Button>
                </form>
            </>
        )}
      </Card>
    </div>
  );
}
