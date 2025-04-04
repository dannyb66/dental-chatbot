import React from 'react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  const formatContent = (content: string) => {
    // Replace Markdown-style bold with spans
    let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert bullet points to proper list items
    formatted = formatted.replace(/\* (.*?)(\n|$)/g, '<li>$1</li>');
    
    // Wrap lists in ul tags
    if (formatted.includes('<li>')) {
      formatted = '<ul class="list-disc list-inside">' + formatted + '</ul>';
    }

    return formatted;
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] px-4 py-2 rounded-lg ${
          isUser
            ? 'bg-blue-500 text-white rounded-br-none'
            : 'bg-gray-100 text-gray-800 rounded-bl-none'
        }`}
      >
        <div 
          className="text-sm"
          dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
        />
        <p className="text-xs mt-1 opacity-70">
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};