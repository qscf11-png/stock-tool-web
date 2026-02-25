import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut, User, AlertCircle } from 'lucide-react';

const LoginButton = () => {
    const { user, loginWithGoogle, logout, error: authError, debugLogs } = useAuth();
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        setError(null);
        setIsLoading(true);
        try {
            await loginWithGoogle();
        } catch (err) {
            console.error("Login error:", err);
            // 顯示使用者友善的錯誤訊息
            if (err.code === 'auth/unauthorized-domain') {
                setError('此網域尚未在 Firebase 中授權。請到 Firebase Console → Authentication → Settings → Authorized domains 新增此網域。');
            } else if (err.code === 'auth/popup-blocked') {
                setError('瀏覽器擋住了彈出視窗，請允許此網站的彈出視窗。');
            } else if (err.code === 'auth/popup-closed-by-user') {
                setError('登入視窗已被關閉。');
            } else if (err.message?.includes('disallowed_useragent') || err.code === 'auth/web-storage-unsupported') {
                setError('Google 封鎖了此內嵌瀏覽器。請點擊右上角（...）並選擇「在瀏覽器中開啟」或使用 Safari/Chrome 打開。');
            } else {
                setError(`登入失敗：${err.code || err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (user) {
        return (
            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg border border-white/10">
                <div className="w-8 h-8 rounded-full overflow-hidden border border-blue-500/50">
                    {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full bg-blue-500 flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{user.displayName}</p>
                    <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                </div>
                <button
                    onClick={logout}
                    className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-red-400 transition-colors"
                    title="登出"
                >
                    <LogOut className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center gap-1">
            <button
                onClick={handleLogin}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all shadow-lg active:scale-95"
            >
                <LogIn className="w-4 h-4" />
                {isLoading ? '登入中...' : '使用 Google 登入'}
            </button>

            {/* 錯誤資訊顯示 */}
            {(error || authError) && (
                <div className="flex flex-col gap-2 w-full max-w-[280px] p-3 bg-red-900/40 border border-red-500/40 rounded-lg text-red-200 text-[11px] leading-relaxed mt-2 shadow-inner">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                        <p>{error || authError}</p>
                    </div>

                    {/* 行動端備援按鈕：如果是在行動端且出現問題，建議嘗試 Popup */}
                    {(authError?.includes('ITP') || authError?.includes('攔截')) && (
                        <button
                            onClick={() => loginWithGoogle(true)}
                            className="mt-1 py-1.5 px-3 bg-blue-600/80 hover:bg-blue-600 text-white rounded text-[10px] font-bold transition-colors shadow-sm active:scale-95"
                        >
                            嘗試強制彈窗模式 (Fallback)
                        </button>
                    )}
                </div>
            )}

            {/* 除錯日誌顯示 (僅在失敗或手機端顯示) */}
            {(debugLogs.length > 0 && !user) && (
                <div className="w-full max-w-[280px] mt-2 p-2 bg-black/60 rounded border border-white/5 font-mono text-[9px] text-gray-400 overflow-hidden">
                    <div className="flex justify-between items-center mb-1 border-b border-white/10 pb-1">
                        <span>系統日誌 (除錯用)</span>
                        <div className="flex gap-2">
                            {/* 手動觸發彈窗的備援入口 */}
                            <button
                                onClick={() => loginWithGoogle(true)}
                                className="text-blue-400 hover:text-blue-300 underline"
                            >
                                強制彈窗
                            </button>
                            <span className="text-[8px] opacity-50">v2.2</span>
                        </div>
                    </div>
                    {debugLogs.map((log, i) => (
                        <div key={i} className="truncate">{log}</div>
                    ))}
                    {debugLogs.length > 0 && (
                        <div className="mt-1 text-[8px] text-blue-400/70 italic text-center">
                            若持續無法登入，請長按日誌並截圖提供。
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LoginButton;
