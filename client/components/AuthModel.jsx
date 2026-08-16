import React, { useState } from "react";
import axios from "axios";

export default function AuthModal({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);

  const [formData, setFormData] = useState({
    user: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

    const payload = isLogin
      ? {
          email: formData.email,
          password: formData.password,
        }
      : {
          user: formData.user,
          email: formData.email,
          password: formData.password,
        };

    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}${endpoint}`,
        payload
      );

      // =========================
      // LOGIN SUCCESS
      // =========================
      if (isLogin && res.data.token) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user));

        onLoginSuccess(res.data.token, res.data.user);
      }

      // =========================
      // REGISTER SUCCESS
      // =========================
      else if (!isLogin) {
        // Form clear
        setFormData({
          user: "",
          email: "",
          password: "",
        });

        // Error clear
        setError("");

        // Login mode par wapas
        setIsLogin(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setError("");

    // Mode switch par form clear
    setFormData({
      user: "",
      email: "",
      password: "",
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md p-8 glass-floating rounded-2xl border border-white/10 shadow-2xl">
        {/* =========================
            HEADER
        ========================= */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[#201f22] flex items-center justify-center border border-white/10">
            <span className="material-symbols-outlined text-[#c0c1ff] text-[28px]">
              auto_awesome
            </span>
          </div>

          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isLogin ? "Welcome Back to DocuMind" : "Create Enterprise Account"}
          </h2>

          <p className="text-xs text-[#c7c4d7] mt-1">
            {isLogin
              ? "Enter your credentials to access docs"
              : "Start asking questions to your PDFs"}
          </p>
        </div>

        {/* =========================
            ERROR
        ========================= */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
            {error}
          </div>
        )}

        {/* =========================
            FORM
        ========================= */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* FULL NAME - REGISTER ONLY */}
          {!isLogin && (
            <div>
              <label className="text-xs font-semibold text-[#c7c4d7] uppercase tracking-wider mb-1 block">
                Full Name
              </label>

              <input
                type="text"
                required
                value={formData.user}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    user: e.target.value,
                  })
                }
                placeholder="Enter your name"
                className="w-full bg-[#201f22] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#c0c1ff]"
              />
            </div>
          )}

          {/* EMAIL */}
          <div>
            <label className="text-xs font-semibold text-[#c7c4d7] uppercase tracking-wider mb-1 block">
              Email Address
            </label>

            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  email: e.target.value,
                })
              }
              placeholder="Enter your email"
              className="w-full bg-[#201f22] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#c0c1ff]"
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label className="text-xs font-semibold text-[#c7c4d7] uppercase tracking-wider mb-1 block">
              Password
            </label>

            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  password: e.target.value,
                })
              }
              placeholder="Enter your password"
              className="w-full bg-[#201f22] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#c0c1ff]"
            />
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[#494bd6] hover:bg-[#8083ff] text-white py-3 rounded-xl font-semibold text-sm transition-all duration-300 shadow-lg shadow-indigo-500/25"
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* =========================
            SWITCH LOGIN / REGISTER
        ========================= */}
        <div className="mt-6 text-center">
          <button
            onClick={toggleAuthMode}
            className="text-xs text-[#c0c1ff] hover:underline"
          >
            {isLogin
              ? "Don't have an account? Register"
              : "Already have an account? Login"}
          </button>
        </div>
      </div>
    </div>
  );
}
