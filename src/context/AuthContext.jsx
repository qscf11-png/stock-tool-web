import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, USE_MOCK_DATA } from '../services/firebaseService';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 若 Firebase 未初始化（mock mode），直接設為已載入
        if (!auth || USE_MOCK_DATA) {
            setLoading(false);
            return;
        }

        // 監聽轉址登入結果
        getRedirectResult(auth).catch((error) => {
            console.error("Redirect login error:", error);
        });

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const loginWithGoogle = async () => {
        if (!auth) {
            console.warn('Firebase Auth 尚未初始化');
            return;
        }

        // 偵測是否為行動裝置
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        try {
            if (isMobile) {
                // 行動裝置優先使用轉址，避免彈出視窗被攔截或 disallowed_useragent 錯誤
                await signInWithRedirect(auth, googleProvider);
            } else {
                await signInWithPopup(auth, googleProvider);
            }
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    const logout = () => {
        if (!auth) return;
        return signOut(auth);
    };

    const value = {
        user,
        loading,
        loginWithGoogle,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
