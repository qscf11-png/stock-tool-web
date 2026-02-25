import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut, User } from 'lucide-react';

const LoginButton = () => {
    const { user, loginWithGoogle, logout } = useAuth();

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
        <button
            onClick={loginWithGoogle}
            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all shadow-lg active:scale-95"
        >
            <LogIn className="w-4 h-4" />
            使用 Google 登入
        </button>
    );
};

export default LoginButton;
