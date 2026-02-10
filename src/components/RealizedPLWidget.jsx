import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { formatCurrency, getPLColorClass } from '../utils/calculations';
import { CalendarRange, Search } from 'lucide-react';

const RealizedPLWidget = () => {
  const { getRealizedPL } = usePortfolio();
  
  // Default to current month
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = today.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [pl, setPl] = useState(0);

  useEffect(() => {
    setPl(getRealizedPL(startDate, endDate));
  }, [startDate, endDate, getRealizedPL]);

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <CalendarRange className="w-5 h-5 text-blue-400" />
        區間已實現損益
      </h2>

      <div className="flex flex-col gap-4">
        <div className="flex gap-2 items-center">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
          />
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-slate-700">
          <div className="text-sm text-gray-400 mb-1">已實現損益</div>
          <div className={`text-2xl font-bold ${getPLColorClass(pl)}`}>
            {formatCurrency(pl)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealizedPLWidget;
