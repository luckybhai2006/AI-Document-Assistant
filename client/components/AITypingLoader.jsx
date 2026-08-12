import React from "react";

export const AITypingLoader = () => {
  return (
    <div className="flex items-center space-x-3 p-3 px-4 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-indigo-500/20 w-fit my-2 shadow-lg animate-fade-in">
      {/* Glowing Icon with Ping Effect */}
      <div className="relative flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-40"></span>
        <svg
          className="w-4 h-4 animate-spin text-indigo-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>

      {/* Animated Bouncing Dots */}
      <div className="flex items-center space-x-1.5">
        <span className="text-sm font-medium text-slate-300 mr-1">
          AI soch raha hai
        </span>
        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
      </div>
    </div>
  );
};
