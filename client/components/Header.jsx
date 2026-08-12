export default function Header({
  selectedDoc,
  isFetchingDocs,
  setIsMobileSidebarOpen,
  handleClearChat,
}) {
  return (
    <header className="h-14 md:h-16 shrink-0 px-4 md:px-6 flex items-center justify-between border-b border-white/5 bg-[#131315]/90 backdrop-blur-md z-30">
      <div className="flex items-center gap-3">
        {/* Hamburger Button for Mobile */}
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 md:hidden text-white hover:bg-white/10 rounded-lg transition-colors flex items-center justify-center"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Connected Document Section */}
        <div className="flex items-center gap-2 bg-[#2a2a2c] py-1.5 px-3 rounded-full border border-white/5 min-w-[160px]">
          <span className="material-symbols-outlined text-[#908fa0] text-[16px]">
            link
          </span>
          <span className="text-[12px] md:text-[13px] text-[#c7c4d7]">
            Connected:
          </span>

          {/* 🟢 PRODUCTION GUARD: Millisecond Flicker Prevention */}
          {isFetchingDocs ? (
            <div className="h-4 w-24 bg-white/10 animate-pulse rounded"></div>
          ) : (
            <span className="text-[12px] md:text-[13px] text-white font-medium truncate max-w-[120px] sm:max-w-[200px] md:max-w-none">
              {selectedDoc
                ? selectedDoc.originalName || selectedDoc.fileName
                : "Select document"}
            </span>
          )}
        </div>
      </div>

      {/* Clear Chat Button */}
      {!isFetchingDocs && selectedDoc && (
        <button
          onClick={handleClearChat}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[12px] md:text-[13px] font-medium transition-all"
          title="Clear Chat History"
        >
          <span className="material-symbols-outlined text-[16px]">
            cleaning_services
          </span>
          <span className="hidden sm:inline">Clear Chat</span>
        </button>
      )}
    </header>
  );
}
