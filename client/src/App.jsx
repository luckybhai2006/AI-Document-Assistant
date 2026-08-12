import React, { useState, useRef, useEffect } from "react";
import AuthModal from "../components/AuthModel";
import ReactMarkdown from "react-markdown";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import ChatInput from "../components/ChatInput";
import axios from "axios";

// Glowing AI Thinking Loader Component
const AITypingLoader = () => {
  return (
    <div className="flex items-center gap-2.5 py-1 text-[#c7c4d7]">
      <div className="relative flex items-center justify-center w-5 h-5 rounded-full bg-[#8083ff]/20 text-[#c0c1ff]">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8083ff] opacity-30"></span>
        <span className="material-symbols-outlined text-[14px] animate-spin">
          auto_awesome
        </span>
      </div>

      <div className="flex items-center space-x-1.5">
        <span className="text-xs font-medium">AI thinking</span>
        <div className="w-1.5 h-1.5 bg-[#c0c1ff] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-1.5 h-1.5 bg-[#c0c1ff] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-1.5 h-1.5 bg-[#c0c1ff] rounded-full animate-bounce"></div>
      </div>
    </div>
  );
};

export default function App() {
  // Auth States
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );

  // Mobile Sidebar Toggle State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // App States
  const [documents, setDocuments] = useState([]);
  // 🟢 ALWAYS initialize as null to avoid initial flicker
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isFetchingDocs, setIsFetchingDocs] = useState(true); // Loading guard
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello! Upload a PDF or select an existing document from the sidebar to ask questions.",
    },
  ]);
  const [inputQuestion, setInputQuestion] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // 1. Fetch User Documents on Page Load / Refresh
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!token) {
        setIsFetchingDocs(false);
        return;
      }

      setIsFetchingDocs(true); // Fetching start

      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/documents`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const docs = res.data.documents || res.data || [];
        setDocuments(docs);

        if (docs.length > 0) {
          // Safe check: pehle se selected doc exist karta hai kya?
          const savedDocId = localStorage.getItem("selectedDocId");
          const matchedDoc = docs.find((d) => d._id === savedDocId);

          if (matchedDoc) {
            setSelectedDoc(matchedDoc);
          } else {
            setSelectedDoc(docs[0]);
            localStorage.setItem("selectedDocId", docs[0]._id);
          }
        } else {
          // Zero documents case: strict cleanup
          setSelectedDoc(null);
          localStorage.removeItem("selectedDocId");
          setMessages([
            {
              role: "ai",
              text: "Hello! Upload a PDF or select an existing document from the sidebar to ask questions.",
            },
          ]);
        }
      } catch (err) {
        console.error("Error fetching documents:", err);
        setSelectedDoc(null);
      } finally {
        setIsFetchingDocs(false); // Fetching complete
      }
    };

    fetchDocuments();
  }, [token]);

  // 2. Refresh ya Selected Document Change par Saved Chats Load karo (FIXED)
  useEffect(() => {
    const fetchChatHistory = async () => {
      // 🟢 FIX 1: Agar token ya document nahi hai, toh purani chat UI par mat rehne do, Reset kar do
      if (!token || !selectedDoc?._id) {
        setMessages([
          {
            role: "ai",
            text: "Hello! Upload a PDF or select an existing document from the sidebar to ask questions.",
          },
        ]);
        return;
      }

      try {
        // 🟢 FIX 2: Request bhejne se PEHLE screen se purani chat clear kar do taaki previous user/doc ka data na dikhe
        setMessages([]);

        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/chat/history/${selectedDoc._id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        const historyMessages = res.data.messages || [];

        if (historyMessages.length > 0) {
          setMessages(historyMessages);
        } else {
          setMessages([
            {
              role: "ai",
              text: "Hello! Upload a PDF or select an existing document from the sidebar to ask questions.",
            },
          ]);
        }
      } catch (err) {
        console.error("Error fetching chat history:", err);
        // Error case mein clean state
        setMessages([
          {
            role: "ai",
            text: "Hello! Upload a PDF or select an existing document from the sidebar to ask questions.",
          },
        ]);
      }
    };

    fetchChatHistory();
  }, [token, selectedDoc]);

  // Selected doc ko localStorage me persist karo taaki refresh pe bhi yaad rahe
  useEffect(() => {
    if (selectedDoc) {
      localStorage.setItem("lastSelectedDoc", JSON.stringify(selectedDoc));
    }
  }, [selectedDoc]);

  // 1. Logout Handler
  const handleLogout = () => {
    // 1. Storage saaf karo
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedDoc");
    localStorage.removeItem("selectedDocId");

    // 2. States reset karo
    setUser(null);
    setSelectedDoc(null);
    setDocuments([]);
    setToken(null); // 👈 Is line ke chalte hi 'if (!token)' trigger hoga aur Auth Screen lightning fast show ho jayegi
  };

  // 2. Login Success Handler
  const handleLoginSuccess = (token, userData) => {
    // 1. Token aur User state set karo
    setToken(token);
    setUser(userData);

    // 2. Naye user ke liye active doc reset karo (taaki purani PDF ka naam header me na aaye)
    setSelectedDoc(null);
    localStorage.removeItem("selectedDoc");

    // 3. Welcome chat screen reset karo
    setMessages([
      {
        role: "ai",
        text: "Hello! Upload a PDF or select an existing document from the sidebar to ask questions.",
      },
    ]);
  };
  // Handle PDF Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploading(true);
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/documents/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const newDoc = res.data.document;
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
      setIsMobileSidebarOpen(false);

      setMessages([
        {
          role: "ai",
          text: `Document **${file.name}** uploaded and indexed successfully! You can ask questions now.`,
        },
      ]);
    } catch (err) {
      alert(err.response?.data?.message || "File upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Stream Chat Response
  const handleSendMessage = async () => {
    if (!inputQuestion.trim()) return;
    if (!selectedDoc) {
      alert("Please select or upload a document first!");
      return;
    }

    const questionText = inputQuestion;
    setInputQuestion("");

    setMessages((prev) => [...prev, { role: "user", text: questionText }]);
    setMessages((prev) => [...prev, { role: "ai", text: "" }]);
    setIsStreaming(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/chat/ask`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            documentId: selectedDoc._id,
            question: questionText,
          }),
        }
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");

        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.replace("data: ", "").trim();
            if (dataStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                setMessages((prevMessages) => {
                  const updated = [...prevMessages];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    text: updated[lastIdx].text + parsed.text,
                  };
                  return updated;
                });
              }
            } catch (e) {
              console.error("Parse Error:", e);
            }
          }
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Error generating response. Check your server connection.",
        },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  // Document Delete Karne Ka Function
  const handleDeleteDocument = async (e, docId) => {
    e.stopPropagation(); // Parent onClick trigger hone se roko

    // 1. Purane states ka backup le lo (agar error aaye toh rollback karne ke liye)
    const previousDocs = [...documents];
    const previousSelectedDoc = selectedDoc;

    // 🟢 OPTIMISTIC UPDATE: UI se INSTANT remove kar do
    const updatedDocs = documents.filter((doc) => doc._id !== docId);
    setDocuments(updatedDocs);

    // Agar deleted document hi abhi screen par open tha, toh active doc switch karo
    if (selectedDoc?._id === docId) {
      if (updatedDocs.length > 0) {
        setSelectedDoc(updatedDocs[0]);
      } else {
        setSelectedDoc(null);
        localStorage.removeItem("selectedDocId");
        setMessages([
          {
            role: "ai",
            text: "Hello! Upload a PDF or select an existing document from the sidebar to ask questions.",
          },
        ]);
      }
    }

    // 2. Background mein Backend API Call karo
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/documents/${docId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    } catch (err) {
      console.error("Error deleting document:", err);
      alert("Failed to delete document. Rolling back changes.");

      // 🔴 ERROR ROLLBACK: Agar server error aaye toh UI ko wapas purani state me le aao
      setDocuments(previousDocs);
      setSelectedDoc(previousSelectedDoc);
    }
  };

  // Chat History Clear Karne Ka Function
  const handleClearChat = async () => {
    if (!selectedDoc?._id) return;

    const confirmClear = window.confirm(
      "Kya aap is document ki chat history clear karna chahte ho?"
    );
    if (!confirmClear) return;

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/chat/history/${selectedDoc._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      // Frontend Messages Reset Karo
      setMessages([
        {
          role: "ai",
          text: `Connected to **${
            selectedDoc.originalName || selectedDoc.fileName
          }**. Chat history has been reset. Ask a new question!`,
        },
      ]);
    } catch (err) {
      console.error("Clear chat error:", err);
      alert("Failed to clear chat history");
    }
  };

  if (!token) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="bg-[#131315] text-[#e5e1e4] h-[100dvh] w-full overflow-hidden flex font-sans fixed inset-0 touch-none">
      <div className="absolute inset-0 bg-grid z-0 pointer-events-none"></div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="application/pdf"
        className="hidden"
      />

      {/* Mobile Overlay Background (Closes sidebar when clicked outside) */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
        ></div>
      )}

      {/* Responsive Sidebar */}
      <Sidebar
        isMobileSidebarOpen={isMobileSidebarOpen}
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        fileInputRef={fileInputRef}
        isUploading={isUploading}
        documents={documents}
        selectedDoc={selectedDoc}
        setSelectedDoc={setSelectedDoc}
        handleDeleteDocument={handleDeleteDocument}
        user={user}
        handleLogout={handleLogout}
      />

      {/* Main Workspace */}
      <main className="flex-1 ml-0 md:ml-[280px] flex flex-col h-[100dvh] relative z-10 overflow-hidden">
        {/* Top Header */}
        <Header
          selectedDoc={selectedDoc}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          handleClearChat={handleClearChat}
        />

        {/* Chat Messages Workspace - Only this scrolls */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-36 md:pb-44 no-scrollbar relative flex flex-col gap-6 max-w-4xl mx-auto w-full overscroll-contain touch-pan-y">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex w-full ${
                msg.role === "user"
                  ? "justify-end pl-6 md:pl-12"
                  : "justify-start pr-6 md:pr-12"
              }`}
            >
              {msg.role === "user" ? (
                <div className="glass-panel rounded-2xl rounded-tr-sm p-3.5 md:p-4 max-w-[85%] bg-[#2a2a2c]/80 border-white/10 text-white shadow-lg">
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                </div>
              ) : (
                <div className="flex gap-3 md:gap-4 max-w-[95%] items-start">
                  <div className="w-8 h-8 rounded-lg bg-[#8083ff] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(192,193,255,0.2)] mt-0.5">
                    <span className="material-symbols-outlined text-[#1000a9] text-[18px]">
                      auto_awesome
                    </span>
                  </div>
                  <div className="flex flex-col gap-2 pt-0.5 min-h-[32px] justify-center">
                    <div className="text-sm text-[#e5e1e4] leading-relaxed prose prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2">
                      {isStreaming &&
                      idx === messages.length - 1 &&
                      msg.text === "" ? (
                        <AITypingLoader />
                      ) : (
                        <>
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                          {isStreaming && idx === messages.length - 1 && (
                            <span className="inline-block w-1.5 h-4 bg-[#c0c1ff] ml-1 animate-pulse"></span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatBottomRef} className="h-4 shrink-0" />
        </div>

        {/* Floating Input Bar */}
        <ChatInput
          selectedDoc={selectedDoc}
          fileInputRef={fileInputRef}
          inputQuestion={inputQuestion}
          setInputQuestion={setInputQuestion}
          handleSendMessage={handleSendMessage}
          isStreaming={isStreaming}
        />
      </main>
    </div>
  );
}
