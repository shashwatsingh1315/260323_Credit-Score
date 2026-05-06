"use client";
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { handleAddComment } from '@/app/cases/[id]/actions';

interface Props {
  caseId: string;
  users: { id: string; full_name: string }[];
}

export default function MentionInput({ caseId, users }: Props) {
  const [content, setContent] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [cursorPos, setCursorPos] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const pos = e.target.selectionStart ?? 0;
    setContent(val);
    setCursorPos(pos);

    // Detect @mention trigger
    const textBefore = val.slice(0, pos);
    const match = textBefore.match(/@(\w*)$/);
    if (match) {
      setMentionSearch(match[1].toLowerCase());
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(mentionSearch)
  ).slice(0, 6);

  const insertMention = (user: { id: string; full_name: string }) => {
    const textBefore = content.slice(0, cursorPos);
    const textAfter = content.slice(cursorPos);
    const newText = textBefore.replace(/@(\w*)$/, `@${user.full_name} `) + textAfter;
    setContent(newText);
    setMentionedIds(prev => [...new Set([...prev, user.id])]);
    setShowDropdown(false);
    ref.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    const fd = new FormData();
    fd.set('caseId', caseId);
    fd.set('content', content.trim());
    fd.set('mentionedUserIds', JSON.stringify(mentionedIds));
    await handleAddComment(fd);
    setContent('');
    setMentionedIds([]);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 relative">
      <textarea
        ref={ref}
        value={content}
        onChange={handleChange}
        placeholder="Add a comment… use @ to tag someone"
        rows={3}
        className="w-full text-sm bg-transparent border border-input rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary resize-none"
        required
      />
      {showDropdown && filteredUsers.length > 0 && (
        <div className="absolute left-0 z-50 w-64 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {filteredUsers.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => insertMention(u)}
              className="w-full text-left px-4 py-2 text-sm hover:bg-muted"
            >
              {u.full_name}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between">
        {mentionedIds.length > 0 && (
          <span className="text-xs text-muted-foreground">
            Tagging: {mentionedIds.map(id => users.find(u => u.id === id)).filter(Boolean).map(u => u!.full_name).join(', ')}
          </span>
        )}
        <Button type="submit" size="sm" className="ml-auto">Post Comment</Button>
      </div>
    </form>
  );
}
