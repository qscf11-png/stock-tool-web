import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, USE_MOCK_DATA } from '../services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [debugLogs, setDebugLogs] = useState([]);

    const addLog = (msg) => {
        const time = new Date().toLocaleTimeString();
        setDebugLogs(prev => [`[${time}] ${msg}`, ...prev].slice(0, 5));
        console.log(`[AuthDebug] ${msg}`);
    };

    useEffect(() => {
        if (!auth || USE_MOCK_DATA) {
            setLoading(false);
            return;
        }

        addLog("正在初始化系統...");

        // 使用 LOCAL 永續性，比起 SESSION 更能在不同裝置上維持
        import('firebase/auth').then(({ setPersistence, browserLocalPersistence }) => {
            setPersistence(auth, browserLocalPersistence).then(() => {
                addLog("狀態持久化已就緒");
            }).catch(e => addLog(`持久化錯誤: ${e.code}`));
        });

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                addLog(`使用者已登入: ${currentUser.email}`);
                setUser(currentUser);
            } else {
                addLog("使用者未登入");
                setUser(null);
            }
            setLoading(false);
        });

        const checkRedirect = async () => {
            try {
                addLog("檢查轉址回傳...");
                const result = await getRedirectResult(auth);
                if (result) {
                    addLog(`轉址成功: ${result.user.email}`);
                    setUser(result.user);
                } else {
                    // 關鍵偵測：如果 URL 有 Auth 特徵但沒有 result，就是 ITP
                    const hasAuthParams = window.location.search.includes('code=') ||
                        window.location.hash.includes('access_token=') ||
                        window.location.search.includes('state=');

                    if (hasAuthParams) {
                        addLog("!!! 偵測到轉址回傳但狀態遺失 (ITP 攔截)");
                        setError("登入權限被瀏覽器攔截 (ITP)。請點擊右上角「...」選擇「在瀏覽器中開啟」，或至 iPhone 設定 -> Safari -> 關閉「防止跨網站追蹤」。");
                    } else {
                        addLog("無待處理轉址結果");
                    }
                }
            } catch (err) {
                addLog(`錯誤: ${err.code}`);
                if (err.code === 'auth/web-storage-unsupported' || err.code === 'auth/network-request-failed') {
                    setError("瀏覽器安全限制 (ITP) 導致無法登入。請改用 Chrome 或原生 Safari 開啟，並關閉「防止跨網站追蹤」。");
                } else {
                    setError(`登入異常: ${err.code}`);
                }
            }
        };

        checkRedirect();
        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async (forcePopup = false) => {
        if (!auth) return;
        setError(null);

        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isWebView = /Line|FBAN|FBAV|Messenger|Instagram/i.test(navigator.userAgent);

        googleProvider.setCustomParameters({
            prompt: 'select_account',
            display: 'touch'
        });

        addLog(`啟動登入 (模式: ${forcePopup ? 'Popup' : 'Redirect'})`);

        try {
            if (forcePopup || (!isMobile && !isWebView)) {
                addLog("執行彈窗登入...");
                await signInWithPopup(auth, googleProvider);
            } else {
                addLog("執行轉址登入...");
                await signInWithRedirect(auth, googleProvider);
            }
        } catch (error) {
            addLog(`啟動失敗: ${error.code}`);
            if (error.code === 'auth/popup-blocked') {
                setError("彈出視窗被攔截，請允許彈出視窗後再試。");
            } else {
                setError(`登入啟動失敗: ${error.code}`);
            }
            throw error;
        }
    };

    const logout = () => {
        if (!auth) return;
        setError(null);
        addLog("正在登出...");
        return signOut(auth);
    };

    const value = {
        user,
        loading,
        error,
        debugLogs,
        loginWithGoogle,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
