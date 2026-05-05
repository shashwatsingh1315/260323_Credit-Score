"use client";
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SearchBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 max-w-md bg-muted rounded-lg px-3 py-1.5 focus-within:ring-1 focus-within:ring-primary">
      <Search size={16} className="text-muted-foreground shrink-0" />
      <input
        type="text"
        placeholder="Search cases or parties..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="bg-transparent text-sm outline-none w-full placeholder:text-muted-foreground"
      />
    </form>
  );
}
