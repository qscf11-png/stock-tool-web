import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, USE_MOCK_DATA } from '../services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // 若 Firebase 未初始化（mock mode），直接設為已載入
        if (!auth || USE_MOCK_DATA) {
            console.log("🛠️ Auth: Mock 模式或 Auth 未初始化");
            setLoading(false);
            return;
        }

        // 1. 立即監聽登入狀態變化，這通常是最準確的源頭
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            console.log("👤 Auth: 使用者狀態改變:", currentUser ? currentUser.email : "未登入");
            setUser(currentUser);
            // 如果是在一般的頁面重整（不是轉址回來），這裡就會結束 loading
            setLoading(false);
        });

        // 2. 處理轉址成功的結果 (Firebase 會在 redirect 回來後將權杖存在專案網域)
        const checkRedirect = async () => {
            try {
                console.log("🛠️ Auth: 檢查轉址結果...");
                const result = await getRedirectResult(auth);
                if (result) {
                    console.log("🚀 Auth: 轉址登入成功!", result.user.email);
                    setUser(result.user);
                }
            } catch (err) {
                console.error("❌ Auth: 轉址結果出錯:", err.code, err.message);
                if (err.code === 'auth/web-storage-unsupported' || err.code === 'auth/network-request-failed') {
                    setError("您的瀏覽器封鎖了第三方儲存空間 (ITP)，導致無法從 Google 取得登入狀態。請使用 Safari/Chrome 並關閉「防止跨網站追蹤」。");
                }
            }
        };

        checkRedirect();
        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        if (!auth) {
            console.warn('Firebase Auth 尚未初始化');
            return;
        }

        setError(null);
        // 偵測是否為行動裝置
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        // 額外偵測是否在 LINE/FB 的內嵌瀏覽器 (WebView)
        const isWebView = /Line|FBAN|FBAV|Messenger/i.test(navigator.userAgent);

        console.log("🖱️ Auth: 觸發登入, 行動裝置:", isMobile, "WebView:", isWebView);

        try {
            if (isWebView || (isMobile && !window.chrome && !window.safari)) {
                // 在 WebView 中，Popup 通常完全被封鎖，Redirect 是唯一機會但也很容易因 Google 政策失敗
                console.log("🚀 Auth: WebView 環境，強制使用 Redirect...");
                await signInWithRedirect(auth, googleProvider);
            } else if (isMobile) {
                // 一般行動瀏覽器，Popup 有時比 Redirect 穩定（因為 Redirect 回來常遺失狀態）
                // 先嘗試 Popup，失敗再 Redirect
                try {
                    console.log("🚀 Auth: 行動裝置，先嘗試 Popup...");
                    await signInWithPopup(auth, googleProvider);
                } catch (e) {
                    if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
                        console.log("🚀 Auth: Popup 被擋，改用 Redirect...");
                        await signInWithRedirect(auth, googleProvider);
                    } else {
                        throw e;
                    }
                }
            } else {
                console.log("🚀 Auth: 電腦版，使用 Popup...");
                await signInWithPopup(auth, googleProvider);
            }
        } catch (error) {
            console.error("❌ Auth: 登入主動作失敗:", error.code, error.message);
            setError(error.message);
            throw error;
        }
    };

    const logout = () => {
        if (!auth) return;
        setError(null);
        return signOut(auth);
    };

    const value = {
        user,
        loading,
        error,
        loginWithGoogle,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
