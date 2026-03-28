import React from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EstoqueSearchFilter = ({ onSearch, onFilter, activeFilter }) => {
  const filters = [
    { label: 'Todos', activeColor: 'bg-[#00d084] hover:bg-[#00b872] text-white' },
    { label: 'Estoque baixo', activeColor: 'bg-[#FFA500] hover:bg-[#e69500] text-[#1a2332]' },
    { label: 'Zerado', activeColor: 'bg-[#EF4444] hover:bg-[#dc2626] text-white' },
    { label: 'OK', activeColor: 'bg-[#00d084] hover:bg-[#00b872] text-white' }
  ];

  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center bg-[#2d3e52] p-4 rounded-lg border border-gray-700 shadow-md">
      <div className="relative w-full md:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por descrição ou código..."
          className="w-full bg-[#1a2332] border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:border-[#00d084] focus:outline-none transition-all"
        />
      </div>
      
      <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-thin">
        {filters.map((filter) => (
          <Button
            key={filter.label}
            onClick={() => onFilter(filter.label)}
            variant={activeFilter === filter.label ? 'default' : 'outline'}
            className={`whitespace-nowrap transition-colors ${
              activeFilter === filter.label 
                ? `${filter.activeColor} border-transparent font-medium` 
                : 'bg-transparent border-gray-600 text-gray-300 hover:text-white hover:bg-[#1a2332] hover:border-gray-500'
            }`}
          >
            {filter.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default EstoqueSearchFilter;