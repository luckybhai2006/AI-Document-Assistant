import React from "react";

export default function VoiceWaveform({
  isListening,
  isTranscribing,
  onStop,
  onCancel,
}) {
  return (
    <div className="flex items-center justify-between gap-3 w-full px-3 py-1 bg-[#1c1c1f] rounded-xl border border-indigo-500/30 animate-pulse">
      <button
        type="button"
        onClick={onCancel}
        disabled={isTranscribing}
        className="p-1.5 text-[#908fa0] hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors shrink-0 disabled:opacity-30"
        title="Cancel recording"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>

      {/* Dynamic State Display */}
      {isTranscribing ? (
        <div className="flex items-center justify-center gap-2 flex-1">
          <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-indigo-300 font-medium">
            Transcribing audio...
          </span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-1.5 flex-1 h-8">
            <span className="w-1 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_100ms] h-4"></span>
            <span className="w-1 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_300ms] h-7"></span>
            <span className="w-1 bg-cyan-400 rounded-full animate-[bounce_1s_infinite_200ms] h-5"></span>
            <span className="w-1 bg-indigo-400 rounded-full animate-[bounce_1s_infinite_400ms] h-8"></span>
            <span className="w-1 bg-indigo-500 rounded-full animate-[bounce_1s_infinite_150ms] h-3"></span>
          </div>

          <span className="text-[11px] text-[#c7c4d7] font-medium tracking-wide">
            Listening...
          </span>

          <button
            type="button"
            onClick={onStop}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all shrink-0"
            title="Transcribe Voice"
          >
            <span className="material-symbols-outlined text-[16px]">check</span>
            <span>Done</span>
          </button>
        </>
      )}
    </div>
  );
}
