import React from "react";

export default function UploadProgressModal({ isUploading, progress }) {
  if (!isUploading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-[320px] md:w-[400px] rounded-2xl border border-white/10 bg-[#18181b]/95 shadow-2xl p-7 text-center">
        {/* Animated Icon */}
        <div className="relative mx-auto mb-6 w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-[#6366f1]/20"></div>

          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#8083ff] animate-spin"></div>

          <span className="material-symbols-outlined text-[#c0c1ff] text-[32px]">
            upload_file
          </span>
        </div>

        <h2 className="text-lg font-semibold text-white mb-2">
          Processing your document
        </h2>

        <p className="text-xs text-[#908fa0] mb-6">
          Uploading and preparing your PDF for AI...
        </p>

        {/* Progress */}
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#494bd6] to-[#8083ff] transition-all duration-300 ease-out"
            style={{
              width: `${Math.min(progress, 100)}%`,
            }}
          ></div>
        </div>

        <div className="flex justify-between mt-3">
          <span className="text-[11px] text-[#908fa0]">
            {progress < 100 ? "Indexing document..." : "Almost done..."}
          </span>

          <span className="text-sm font-semibold text-[#c0c1ff]">
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </div>
  );
}
