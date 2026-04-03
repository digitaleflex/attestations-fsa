"use client";

import { useEffect, useState } from "react";

export function TypewriterHero({ messages }: { messages: string[] }) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(100);

  useEffect(() => {
    const handleTyping = () => {
      const fullMessage = messages[currentMessageIndex];
      
      if (!isDeleting) {
        setCurrentText(fullMessage.substring(0, currentText.length + 1));
        setTypingSpeed(70);

        if (currentText === fullMessage) {
          setTimeout(() => setIsDeleting(true), 2500);
          setTypingSpeed(100);
        }
      } else {
        setCurrentText(fullMessage.substring(0, currentText.length - 1));
        setTypingSpeed(40);

        if (currentText === "") {
          setIsDeleting(false);
          setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
          setTypingSpeed(100);
        }
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [currentText, isDeleting, messages, currentMessageIndex, typingSpeed]);

  return (
    <p className="text-lg md:text-2xl text-slate-400 font-bold max-w-2xl mx-auto leading-relaxed min-h-[4rem] px-4 italic selection:bg-emerald-500 selection:text-white transition-all duration-300">
      {currentText}
      <span className="inline-block w-[2px] h-6 bg-emerald-500 ml-1 animate-pulse" />
    </p>
  );
} 
