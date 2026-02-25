import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut, User, AlertCircle } from 'lucide-react';

const LoginButton = () => {
    const { user, loginWithGoogle, logout } = useAuth();
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
            {error && (
                <div className="flex items-start gap-1 max-w-[280px] p-2 bg-red-900/30 border border-red-500/30 rounded text-red-300 text-[10px] leading-tight">
                    <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default LoginButton;
