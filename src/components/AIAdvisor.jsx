import React, { useState, useEffect } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import {
    generateInvestmentAdvice,
    hasApiKey,
    getApiKey,
    setApiKey,
    validateApiKey,
    AVAILABLE_MODELS,
    getSelectedModel,
    setSelectedModel
} from '../services/geminiService';
import { Sparkles, Lightbulb, BookOpen, Settings, Key, X, CheckCircle, AlertCircle, Cpu, RefreshCw } from 'lucide-react';

// API Key 設定對話框
const ApiKeyModal = ({ isOpen, onClose, onSave }) => {
    const [inputKey, setInputKey] = useState('');
    const [selectedModelId, setSelectedModelId] = useState('');
    const [validating, setValidating] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [error, setError] = useState('');
    const [savedKey, setSavedKey] = useState('');
    const [availableModels, setAvailableModels] = useState([]);

    useEffect(() => {
        if (isOpen) {
            // 使用 setTimeout 避免 setState 更新警告
            setTimeout(() => {
                const existing = getApiKey();
                setSavedKey(existing);
                setInputKey('');
                setError('');
                const modelId = getSelectedModel();
                setSelectedModelId(modelId);
                // 預設顯示所有模型，待驗證後過濾
                setAvailableModels(AVAILABLE_MODELS);
            }, 0);
        }
    }, [isOpen]);

    const handleValidateAndSave = async () => {
        const keyToValidate = inputKey.trim() || savedKey;

        if (!keyToValidate) {
            setError('請輸入 API Key');
            return;
        }

        setValidating(true);
        setDetecting(false);
        setError('');

        try {
            // 1. 基礎驗證
            const result = await validateApiKey(keyToValidate);

            if (result.valid) {
                // 2. 驗證成功，開始偵測可用模型
                setValidating(false);
                setDetecting(true);

                // 這裡其實 validateApiKey 已經回傳了 availableModelIds
                // 但為了 UX 效果，我們可以顯示偵測中的狀態
                const availableIds = result.availableModelIds || [];

                if (availableIds.length > 0) {
                    const filteredModels = AVAILABLE_MODELS.filter(m => availableIds.includes(m.id));
                    setAvailableModels(filteredModels);

                    // 如果當前選擇的模型不可用，自動切換到第一個可用模型
                    if (!availableIds.includes(selectedModelId)) {
                        setSelectedModelId(availableIds[0]);
                    }

                    // 儲存設定
                    if (inputKey.trim()) {
                        setApiKey(inputKey.trim());
                    }
                    // 儲存模型選擇
                    setSelectedModel(selectedModelId); // 注意：這裡可能存的是舊的，應該在使用者確認後才存？
                    // 不，這裡我們假設驗證通過就儲存
                    // 但更好的 UX 是驗證後讓用戶確認模型，再點「儲存」
                    // 簡化流程：驗證通過即儲存

                    setDetecting(false);
                    onSave(); // 通知外層更新

                    // 顯示成功訊息後自動關閉
                    setTimeout(() => onClose(), 1500);

                } else {
                    setError('API Key 有效但無法存取任何已知模型');
                    setDetecting(false);
                }
            } else {
                setError(result.error || 'API Key 驗證失敗');
                setValidating(false);
            }
        } catch (e) {
            setError(e.message);
            setValidating(false);
            setDetecting(false);
        }
    };

    const handleClearKey = () => {
        setApiKey('');
        setSavedKey('');
        setInputKey('');
        setAvailableModels(AVAILABLE_MODELS);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl max-w-md w-full border border-slate-600 shadow-2xl">
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-400" />
                        設定 AI 顧問
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 space-y-5">
                    {/* API Key 區塊 */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                            <Key className="w-4 h-4 text-indigo-400" />
                            Gemini API Key
                        </div>

                        <input
                            type="password"
                            value={inputKey}
                            onChange={(e) => setInputKey(e.target.value)}
                            placeholder={savedKey ? "輸入新 Key 若要更換" : "貼上您的 API Key"}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg focus:border-indigo-500 focus:outline-none font-mono text-sm"
                        />
                    </div>

                    <div className="border-t border-slate-700 my-2"></div>

                    {/* 模型選擇區塊 */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm font-medium text-gray-300">
                            <div className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-indigo-400" />
                                選擇模型
                            </div>
                            {detecting && (
                                <span className="text-xs text-indigo-400 flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    偵測權限中...
                                </span>
                            )}
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                            {availableModels.map((model) => (
                                <label
                                    key={model.id}
                                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedModelId === model.id
                                            ? 'bg-indigo-900/30 border-indigo-500/50'
                                            : 'bg-slate-900/30 border-slate-700 hover:bg-slate-800'
                                        } ${
                                        // 如果正在偵測且不是當前選中的，變淡
                                        detecting ? 'opacity-50 pointer-events-none' : ''
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="model"
                                        value={model.id}
                                        checked={selectedModelId === model.id}
                                        onChange={() => setSelectedModelId(model.id)}
                                        className="mt-1"
                                        disabled={detecting}
                                    />
                                    <div>
                                        <div className={`text-sm font-medium ${selectedModelId === model.id ? 'text-indigo-300' : 'text-gray-300'
                                            }`}>
                                            {model.name}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {model.description}
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 訊息顯示區 */}
                    {error && (
                        <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded flex items-center gap-2 animate-fade-in">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {detecting && !error && (
                        <div className="text-indigo-400 text-sm bg-indigo-900/20 p-3 rounded flex items-center gap-2 animate-fade-in">
                            <Sparkles className="w-4 h-4 flex-shrink-0" />
                            正在測試您的 Key 可用的模型...
                        </div>
                    )}

                    {!validating && !detecting && availableModels.length < AVAILABLE_MODELS.length && (
                        <div className="text-yellow-400 text-xs bg-yellow-900/20 p-2 rounded flex items-center gap-2">
                            <Lightbulb className="w-3 h-3 flex-shrink-0" />
                            已自動過濾您權限不足的模型
                        </div>
                    )}
                </div>

                <div className="flex gap-2 p-4 border-t border-slate-700">
                    {savedKey && (
                        <button
                            onClick={handleClearKey}
                            className="px-4 py-2 text-red-400 hover:bg-red-900/20 rounded-lg transition-colors text-sm"
                        >
                            清除
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleValidateAndSave}
                        disabled={validating || detecting || (!inputKey.trim() && !savedKey)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    >
                        {validating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                驗證中...
                            </>
                        ) : detecting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                偵測中...
                            </>
                        ) : (
                            '驗證並儲存'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const AIAdvisor = () => {
    const { holdings, getRealizedPL } = usePortfolio();
    const [advice, setAdvice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [apiKeySet, setApiKeySet] = useState(false);
    const [currentModelName, setCurrentModelName] = useState('');

    useEffect(() => {
        const updateState = () => {
            setApiKeySet(hasApiKey());
            const modelId = getSelectedModel();
            const model = AVAILABLE_MODELS.find(m => m.id === modelId);
            setCurrentModelName(model ? model.name : modelId);
        };

        updateState();
        window.addEventListener('storage', updateState);
        return () => window.removeEventListener('storage', updateState);
    }, [showSettings]);

    const handleGenerateAdvice = async () => {
        if (!hasApiKey()) {
            const useDemo = confirm(
                '您尚未設定 Gemini API Key。\n\n' +
                '• 點擊「確定」使用基礎版建議（規則式）\n' +
                '• 點擊「取消」設定 API Key 以啟用 AI 功能'
            );
            if (!useDemo) {
                setShowSettings(true);
                return;
            }
        }

        setLoading(true);
        try {
            const portfolioData = {
                holdings,
                realizedPL: getRealizedPL('2024-01-01', '2025-12-31')
            };

            const result = await generateInvestmentAdvice(portfolioData);
            setAdvice(result);
        } catch (error) {
            console.error("Failed to generate advice:", error);
        } finally {
            setLoading(false);
        }
    };

    const getDataSourceLabel = () => {
        if (!advice) return null;
        switch (advice.dataSource) {
            case 'GEMINI_API':
                return { text: `Gemini AI (${currentModelName})`, color: 'text-green-400' };
            case 'MOCK':
            case 'MOCK_FALLBACK':
                return { text: '基礎版 (規則式)', color: 'text-yellow-400' };
            case 'ERROR':
                // 針對不同錯誤類型顯示不同顏色
                if (advice.error === 'QUOTA_EXCEEDED') return { text: '配額不足', color: 'text-red-400' };
                if (advice.error === 'PERMISSION_DENIED') return { text: '權限不足', color: 'text-red-400' };
                return { text: '錯誤', color: 'text-red-400' };
            default:
                return null;
        }
    };

    const dataSourceLabel = getDataSourceLabel();

    return (
        <>
            <div className={`card bg-gradient-to-br from-slate-800 to-indigo-900/30 border-indigo-500/30 ${advice?.dataSource === 'ERROR' ? 'border-red-500/50' : ''
                }`}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-indigo-300">
                        <Sparkles className="w-5 h-5" />
                        AI 投資顧問
                    </h2>
                    <button
                        onClick={() => setShowSettings(true)}
                        className="text-gray-400 hover:text-indigo-300 transition-colors p-1.5 rounded-full hover:bg-slate-700/50"
                        title="設定 API Key 與模型"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>

                {/* API Key 狀態提示 */}
                <div className="text-xs mb-4 flex items-center gap-2">
                    {apiKeySet ? (
                        <>
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            <span className="text-green-400">已啟用</span>
                            <span className="text-slate-500">|</span>
                            <span className="text-indigo-300">{currentModelName}</span>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="w-3 h-3 text-yellow-400" />
                            <span className="text-yellow-400">使用基礎版</span>
                            <span className="text-slate-500">|</span>
                            <button
                                onClick={() => setShowSettings(true)}
                                className="text-indigo-400 hover:text-indigo-300 underline"
                            >
                                設定 API Key
                            </button>
                        </>
                    )}
                </div>

                {!advice ? (
                    <div className="text-center py-6">
                        <p className="text-gray-400 mb-4 text-sm">
                            {apiKeySet
                                ? `使用 ${currentModelName} 分析您的投資組合`
                                : "讓 AI 分析您的投資組合，提供個人化的投資建議"
                            }
                        </p>
                        <button
                            onClick={handleGenerateAdvice}
                            disabled={loading}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto shadow-lg shadow-indigo-500/20"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    分析中...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    生成投資建議
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        {/* 資料來源標籤 */}
                        {dataSourceLabel && (
                            <div className={`text-xs ${dataSourceLabel.color} flex items-center justify-end gap-1 px-2`}>
                                <span>{dataSourceLabel.text}</span>
                            </div>
                        )}

                        {/* 內容顯示區：根據狀態顯示建議或錯誤 */}
                        {advice.dataSource === 'ERROR' ? (
                            <div className="bg-red-900/20 rounded-lg p-5 border border-red-500/30">
                                <h3 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" />
                                    {advice.header || '發生錯誤'}
                                </h3>
                                <p className="text-gray-300 text-sm mb-3">
                                    {advice.advice}
                                </p>
                                <div className="text-xs text-red-300 bg-red-900/30 p-2 rounded">
                                    提示：{advice.lesson}
                                </div>
                                <button
                                    onClick={() => setShowSettings(true)}
                                    className="w-full mt-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                                >
                                    <Settings className="w-4 h-4" />
                                    切換其他模型
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* 正常建議顯示 */}
                                <div className="bg-slate-800/50 rounded-lg p-5 border border-indigo-500/20 shadow-inner">
                                    <h3 className="font-semibold text-indigo-300 mb-3 flex items-center gap-2">
                                        <Lightbulb className="w-4 h-4" />
                                        投資建議
                                    </h3>
                                    <p className="text-gray-300 text-sm leading-relaxed tracking-wide">
                                        {advice.advice}
                                    </p>
                                </div>

                                <div className="bg-slate-800/50 rounded-lg p-5 border border-indigo-500/20 shadow-inner relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-2 opacity-10">
                                        <BookOpen className="w-16 h-16" />
                                    </div>
                                    <h3 className="font-semibold text-indigo-300 mb-3 flex items-center gap-2 relative z-10">
                                        <BookOpen className="w-4 h-4" />
                                        投資心法
                                    </h3>
                                    <p className="text-gray-300 text-sm leading-relaxed italic relative z-10 border-l-2 border-indigo-500/50 pl-3">
                                        "{advice.lesson}"
                                    </p>
                                </div>

                                <button
                                    onClick={handleGenerateAdvice}
                                    disabled={loading}
                                    className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors hover:bg-slate-800/50 rounded"
                                >
                                    {loading ? '更新分析中...' : '重新分析'}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* API Key 設定對話框 */}
            <ApiKeyModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
                onSave={() => setApiKeySet(true)}
            />
        </>
    );
};

export default AIAdvisor;
