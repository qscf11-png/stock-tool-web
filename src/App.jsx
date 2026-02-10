import React, { useState } from 'react';
import { PortfolioProvider } from './context/PortfolioContext';
import PortfolioSummary from './components/PortfolioSummary';
import HoldingsList from './components/HoldingsList';
import TransactionHistory from './components/TransactionHistory';
import RealizedPLWidget from './components/RealizedPLWidget';
import AIAdvisor from './components/AIAdvisor';
import SectorExposure from './components/SectorExposure';
import ContextualAlerts from './components/ContextualAlerts';
import TransactionForm from './components/TransactionForm';
import PerformanceTracker from './components/PerformanceTracker';
import { Plus, RefreshCw, TrendingUp, Wallet, Download, Upload, FileSpreadsheet } from 'lucide-react';
import { usePortfolio } from './context/PortfolioContext';

const AppContent = () => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState('portfolio'); // 'portfolio' or 'performance'
  const { refreshPrices, loading, exportData, importData, exportToExcel, importFromExcel } = usePortfolio();

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (confirm('匯入 JSON 將覆蓋現有資料，確定要繼續嗎？\n建議先匯出 JSON 作為備份。')) {
      try {
        await importData(file);
        alert('匯入成功！');
      } catch (error) {
        alert('匯入失敗：' + error.message);
      }
    }
    e.target.value = '';
  };

  const handleImportExcel = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (confirm('匯入 Excel 將覆蓋/更新現有交易記錄，確定要繼續嗎？\n建議先匯出 JSON 作為備份。')) {
      try {
        await importFromExcel(file);
        alert('Excel 匯入成功！');
      } catch (error) {
        alert('Excel 匯入失敗：' + error.message);
      }
    }
    e.target.value = '';
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                台股投資健康度檢視工具
              </h1>
              <p className="text-gray-400 mt-2">
                追蹤績效 • 評估健康度 • 風險預警
              </p>
            </div>

            <div className="flex gap-3">
              {/* Excel Operations */}
              <button
                onClick={exportToExcel}
                className="btn-secondary flex items-center gap-2 text-green-400 border-green-800/50 hover:bg-green-900/20"
                title="匯出 Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Excel 匯出</span>
              </button>

              <label className="btn-secondary flex items-center gap-2 cursor-pointer text-green-400 border-green-800/50 hover:bg-green-900/20" title="匯入 Excel">
                <FileSpreadsheet className="w-4 h-4" />
                <span className="hidden sm:inline">Excel 匯入</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleImportExcel}
                />
              </label>

              <div className="w-px h-8 bg-slate-700 mx-1"></div>

              {/* JSON Operations */}
              <button
                onClick={exportData}
                className="btn-secondary flex items-center gap-2"
                title="匯出 JSON (備份)"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">備份</span>
              </button>

              <label className="btn-secondary flex items-center gap-2 cursor-pointer" title="匯入 JSON (復原)">
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">復原</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImport}
                />
              </label>

              <button
                onClick={refreshPrices}
                disabled={loading}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                更新價格
              </button>

              <button
                onClick={() => setShowAddForm(true)}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                新增交易
              </button>
            </div>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`px-6 py-3 font-medium transition-all flex items-center gap-2 ${activeTab === 'portfolio'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            <Wallet className="w-5 h-5" />
            持股管理
          </button>
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-6 py-3 font-medium transition-all flex items-center gap-2 ${activeTab === 'performance'
              ? 'border-b-2 border-blue-500 text-blue-400'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            <TrendingUp className="w-5 h-5" />
            績效追蹤
          </button>
        </div>

        {/* Main Content */}
        {activeTab === 'portfolio' ? (
          <div className="space-y-6">
            {/* Portfolio Summary */}
            <PortfolioSummary />

            {/* Holdings List */}
            <HoldingsList />

            {/* Transaction History */}
            <TransactionHistory />

            {/* Risk Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <SectorExposure />
              </div>
              <div className="space-y-6">
                <RealizedPLWidget />
                <AIAdvisor />
                <ContextualAlerts />
              </div>
            </div>
          </div>
        ) : (
          <PerformanceTracker />
        )}

        {/* Add Transaction Modal */}
        {showAddForm && (
          <TransactionForm onClose={() => setShowAddForm(false)} />
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <PortfolioProvider>
      <AppContent />
    </PortfolioProvider>
  );
}

export default App;
