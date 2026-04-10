"use client";

import { useState, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";

interface ProjectChatProps {
  missionId: string;
  studentId: string;
}

export default function ProjectChat({ missionId, studentId }: ProjectChatProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [missionId, studentId]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat?missionId=${missionId}&userId=${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {}
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isLoading) return;
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage.trim(),
          missionId: missionId,
          userId: studentId
        })
      });

      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setNewMessage("");
      }
    } catch (err) {
      toast.error("Erreur d'envoi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-3 mb-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aucun message</p>
          </div>
        ) : (
          messages.map((m) => {
            const isAdmin = m.senderRole === "admin";
            return (
              <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-2.5 rounded-2xl text-[10px] ${
                  isAdmin ? 'bg-slate-900 text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none border border-slate-100 shadow-sm'
                }`}>
                  <p className="leading-relaxed">{m.content}</p>
                  <p className={`text-[8px] mt-1 font-bold ${isAdmin ? 'text-slate-500' : 'text-slate-400'}`}>
                    {format(new Date(m.createdAt), 'HH:mm')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSendMessage} className="flex gap-2">
        <Input 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Répondre..." 
          className="h-9 rounded-xl border-none bg-white text-[10px] shadow-sm focus-visible:ring-indigo-100"
        />
        <Button type="submit" disabled={isLoading || !newMessage.trim()} size="icon" className="h-9 w-9 shrink-0 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100">
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
        </Button>
      </form>
    </div>
  );
}
