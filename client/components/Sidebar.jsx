import React from "react";

export default function Sidebar({
  isMobileSidebarOpen,
  setIsMobileSidebarOpen,
  fileInputRef,
  isUploading,
  documents,
  selectedDoc,
  setSelectedDoc,
  handleDeleteDocument,
  user,
  handleLogout,
}) {
  return (
    <nav
      className={`fixed left-0 top-0 h-[100dvh] w-[280px] p-4 z-50 shadow-2xl border-r border-white/10 bg-[#131315]/95 backdrop-blur-xl flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between mb-8 px-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#201f22] flex items-center justify-center border border-white/10 overflow-hidden relative">
            <span className="material-symbols-outlined text-[#c0c1ff]">
              auto_awesome
            </span>
          </div>
          <div>
            <h1 className="font-bold text-[20px] text-[#c0c1ff] tracking-tight">
              DocuMind AI
            </h1>
            <p className="text-[10px] text-[#c7c4d7] uppercase tracking-widest">
              Enterprise Tier
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="md:hidden text-[#908fa0] hover:text-white p-1"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>

      {/* Upload Button */}
      <button
        onClick={() => fileInputRef.current.click()}
        disabled={isUploading}
        className="w-full flex items-center justify-center gap-2 bg-[#494bd6] hover:bg-[#8083ff] text-white py-3 px-4 rounded-lg mb-6 transition-all duration-300 font-semibold text-sm shadow-lg shadow-indigo-500/20"
      >
        <span className="material-symbols-outlined text-[18px]">
          upload_file
        </span>
        {isUploading ? "Uploading..." : "Upload Document"}
      </button>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1 overscroll-contain">
        <p className="text-[11px] font-semibold text-[#908fa0] mb-2 px-3 tracking-wider">
          CURRENT CONTEXT
        </p>
        <div className="flex flex-col gap-2 px-1">
          {documents.length === 0 ? (
            <p className="text-xs text-[#908fa0] px-3">No PDFs uploaded yet.</p>
          ) : (
            documents.map((doc) => (
              <div
                key={doc._id}
                onClick={() => {
                  setSelectedDoc(doc);
                  setIsMobileSidebarOpen(false);
                }}
                className={`group glass-panel p-3 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                  selectedDoc?._id === doc._id
                    ? "bg-white/10 border-[#c0c1ff]"
                    : "hover:bg-white/5"
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden mr-2">
                  <span className="material-symbols-outlined text-[#4cd7f6] text-[18px] shrink-0">
                    picture_as_pdf
                  </span>
                  <span className="text-[13px] truncate text-white">
                    {doc.originalName || doc.fileName}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1 group-hover:hidden">
                    <div className="w-2 h-2 rounded-full bg-[#4cd7f6] glow-dot-ready"></div>
                    <span className="text-[9px] text-[#4cd7f6] tracking-wider font-semibold">
                      READY
                    </span>
                  </div>

                  <button
                    onClick={(e) => handleDeleteDocument(e, doc._id)}
                    className="hidden group-hover:flex items-center justify-center p-1 rounded hover:bg-red-500/20 text-[#908fa0] hover:text-red-400 transition-all"
                    title="Delete PDF & Chat History"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-xs text-white">
            {user?.user
              ? user.user.substring(0, 2).toUpperCase()
              : user?.email
              ? user.email.substring(0, 2).toUpperCase()
              : "AI"}
          </div>
          <div>
            <p className="text-[13px] font-medium text-white">
              {user?.user || user?.email?.split("@")[0] || "User"}
            </p>
            <p className="text-[10px] text-[#c7c4d7]">
              {user?.email || "Connected"}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          title="Logout"
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-[#908fa0] hover:text-red-400"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
        </button>
      </div>
    </nav>
  );
}
