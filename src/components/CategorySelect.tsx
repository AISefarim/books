import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

interface CategorySelectProps {
  categories: string[];
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
  placeholder?: string;
  className?: string;
}

export function CategorySelect({
  categories,
  selectedCategory,
  onSelect,
  placeholder = "All Categories",
  className = ""
}: CategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredCategories = categories.filter(cat => 
    cat.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full sm:w-64 px-4 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all flex items-center justify-between text-left text-sm"
      >
        <span className="truncate pr-4">{selectedCategory || placeholder}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-indigo-500' : 'text-slate-400'}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden pt-2 flex flex-col">
          <div className="px-3 pb-2 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-64 py-2 custom-scrollbar">
            <button
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
                setSearchQuery('');
              }}
              className={`w-full text-left px-4 py-2 text-sm font-semibold flex items-center justify-between transition-colors ${
                selectedCategory === null 
                  ? 'bg-indigo-50 text-indigo-600' 
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {placeholder}
              {selectedCategory === null && <Check className="w-4 h-4" />}
            </button>
            
            {filteredCategories.length > 0 ? (
              filteredCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    onSelect(cat);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full text-left px-4 py-2 text-sm font-semibold flex items-center justify-between transition-colors ${
                    selectedCategory === cat 
                      ? 'bg-indigo-50 text-indigo-600' 
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate pr-4">{cat}</span>
                  {selectedCategory === cat && <Check className="w-4 h-4 shrink-0" />}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400 text-center font-medium">
                No categories found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
