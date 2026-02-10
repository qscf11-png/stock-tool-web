// Gemini AI Service for Investment Advice
// 整合 Google Generative AI SDK，支援使用者自行輸入 API Key 和選擇模型

import { GoogleGenerativeAI } from '@google/generative-ai';

// ===== 常數定義 =====

const API_KEY_STORAGE_KEY = 'tw-stock-gemini-api-key';
const MODEL_STORAGE_KEY = 'tw-stock-gemini-model';

// 可用的 Gemini 模型列表（移除舊版 1.5，專注於 2.0）
export const AVAILABLE_MODELS = [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: '最新標準版，速度快且穩定' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', description: '極輕量版，回應最快' },
    { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking', description: '增強推理能力 (實驗版)' },
];

const DEFAULT_MODEL = 'gemini-2.0-flash';

// ===== API Key 管理 =====

/**
 * 取得已儲存的 API Key
 */
export const getApiKey = () => {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
};

/**
 * 儲存 API Key
 */
export const setApiKey = (key) => {
    if (key) {
        localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
};

/**
 * 檢查 API Key 是否已設定
 */
export const hasApiKey = () => {
    const key = getApiKey();
    return key && key.length > 10;
};

// ===== 模型管理 =====

/**
 * 取得已選擇的模型
 */
export const getSelectedModel = () => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    // 確保儲存的模型在可用列表中，否則使用預設值
    if (saved && AVAILABLE_MODELS.some(m => m.id === saved)) {
        return saved;
    }
    return DEFAULT_MODEL;
};

/**
 * 設定模型
 */
export const setSelectedModel = (modelId) => {
    localStorage.setItem(MODEL_STORAGE_KEY, modelId);
};

/**
 * 偵測 API Key 可用的模型列表
 */
export const detectAvailableModels = async (apiKey) => {
    if (!apiKey) return [];

    const genAI = new GoogleGenerativeAI(apiKey);
    const validModels = [];

    // 並行測試所有模型
    const promises = AVAILABLE_MODELS.map(async (modelInfo) => {
        try {
            const model = genAI.getGenerativeModel({ model: modelInfo.id });
            await model.generateContent('Hi'); // 極簡測試
            return modelInfo.id;
        } catch (error) {
            console.warn(`Model ${modelInfo.id} not available:`, error.message);
            return null;
        }
    });

    const results = await Promise.all(promises);
    return results.filter(id => id !== null);
};


/**
 * 驗證 API Key 是否有效並取得可用的模型
 */
export const validateApiKey = async (apiKey) => {
    try {
        // 1. 先測試預設模型或第一個模型
        const genAI = new GoogleGenerativeAI(apiKey);
        const testModel = AVAILABLE_MODELS[0].id;
        const model = genAI.getGenerativeModel({ model: testModel });

        await model.generateContent('Test');

        // 2. 驗證成功，進一步偵測所有可用模型
        const availableModelIds = await detectAvailableModels(apiKey);

        return {
            valid: true,
            availableModelIds
        };
    } catch (error) {
        return {
            valid: false,
            error: error.message || 'API Key 驗證失敗'
        };
    }
};

// ===== 投資建議生成 =====

/**
 * 使用 Gemini API 生成投資建議
 */
export const generateInvestmentAdvice = async (portfolioData) => {
    const apiKey = getApiKey();

    if (!apiKey) {
        return generateMockAdvice(portfolioData);
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelId = getSelectedModel();
        const model = genAI.getGenerativeModel({ model: modelId });

        const { holdings } = portfolioData;

        // 準備持股摘要
        const holdingsSummary = holdings.map(h =>
            `${h.symbol}: ${h.shares}股, 成本${h.avgCost?.toFixed(2)}元, 現價${h.currentPrice?.toFixed(2)}元`
        ).join('\n');

        const totalValue = holdings.reduce((sum, h) => sum + (h.shares * (h.currentPrice || 0)), 0);
        const totalCost = holdings.reduce((sum, h) => sum + (h.shares * (h.avgCost || 0)), 0);
        const unrealizedPL = totalValue - totalCost;

        const prompt = `你是一位專業的台股投資顧問。請根據以下投資組合提供分析和建議。

## 投資組合概況
- 持股數：${holdings.length}檔
- 總市值：NT$ ${totalValue.toLocaleString()}
- 總成本：NT$ ${totalCost.toLocaleString()}
- 未實現損益：NT$ ${unrealizedPL.toLocaleString()} (${totalCost > 0 ? ((unrealizedPL / totalCost) * 100).toFixed(2) : 0}%)

## 持股明細
${holdingsSummary || '(目前無持股)'}

請提供：
1. 投資建議 (advice)：簡短分析目前投資組合，約 50 字。
2. 投資心法 (lesson)：一句經典投資智慧，約 20 字。

請用繁體中文回答，以 JSON 格式回傳：
{"advice": "...", "lesson": "..."}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // 解析 JSON 回應
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                ...parsed,
                dataSource: 'GEMINI_API',
                model: modelId
            };
        }

        return {
            advice: text,
            lesson: '投資需要耐心與紀律。',
            dataSource: 'GEMINI_API',
            model: modelId
        };

    } catch (error) {
        console.error('Gemini API 呼叫失敗:', error);

        // 簡化錯誤訊息
        if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('401')) {
            return {
                header: 'API Key 無效',
                advice: '請重新設定正確的 Key',
                lesson: '驗證失敗',
                dataSource: 'ERROR',
                error: 'API_KEY_INVALID'
            };
        }

        // 429 Quota Exceeded / Rate Limit
        if (error.message?.includes('429') || error.message?.includes('Quota exceeded')) {
            return {
                header: '配額不足',
                advice: '免費版額度已滿，請切換模型或稍候',
                lesson: '建議使用 Flash Lite',
                dataSource: 'ERROR',
                error: 'QUOTA_EXCEEDED'
            };
        }

        // 403 Permission Denied (Model not accessible)
        if (error.message?.includes('403') || error.message?.includes('permission')) {
            return {
                header: '權限不足',
                advice: '此 Key 無法存取該模型，請切換其他模型',
                lesson: '請嘗試其他 Flash 模型',
                dataSource: 'ERROR',
                error: 'PERMISSION_DENIED'
            };
        }

        // 模型不支援
        if (error.message?.includes('not found') || error.message?.includes('404')) {
            return {
                header: '模型不可用',
                advice: '請在設定中更換模型',
                lesson: '建議使用 Flash',
                dataSource: 'ERROR',
                error: 'MODEL_NOT_FOUND'
            };
        }

        return {
            ...generateMockAdvice(portfolioData),
            dataSource: 'MOCK_FALLBACK',
            error: error.message
        };
    }
};

/**
 * Mock 投資建議（無 API Key 時使用）
 */
const generateMockAdvice = async (portfolioData) => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const { holdings } = portfolioData;

    if (holdings.length === 0) {
        return {
            lesson: "投資的第一步是建立部位。",
            advice: "目前無持股。建議從權值股開始研究。",
            dataSource: 'MOCK'
        };
    }

    const totalValue = holdings.reduce((sum, h) => sum + (h.shares * h.currentPrice), 0);
    const totalCost = holdings.reduce((sum, h) => sum + (h.shares * h.avgCost), 0);
    const unrealizedPL = totalValue - totalCost;
    const isProfit = unrealizedPL > 0;

    if (isProfit) {
        return {
            lesson: "順勢而為，抱緊獲利。",
            advice: `目前獲利 ${((unrealizedPL / totalCost) * 100).toFixed(1)}%。建議設好移動停利。`,
            dataSource: 'MOCK'
        };
    } else {
        return {
            lesson: "停損是投資最重要的紀律。",
            advice: `目前回檔。建議檢視基本面，跌破支撐應減碼。`,
            dataSource: 'MOCK'
        };
    }
};
