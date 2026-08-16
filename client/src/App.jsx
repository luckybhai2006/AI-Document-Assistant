import React, { useState, useRef, useEffect } from "react";
import AuthModal from "../components/AuthModel";
import ReactMarkdown from "react-markdown";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import ChatInput from "../components/ChatInput";
import UploadProgressModal from "../components/UploadProgressModal";
import axios from "axios";

// AI THINKING LOADER
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
  // AUTH
  const [token, setToken] = useState(localStorage.getItem("token") || "");

  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );

  // MOBILE SIDEBAR
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  // DOCUMENT STATES
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(() => {
    const savedDoc = localStorage.getItem("selectedDoc");
    return savedDoc ? JSON.parse(savedDoc) : null;
  });
  const [isFetchingDocs, setIsFetchingDocs] = useState(true);
  // CHAT STATES
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello! Upload a PDF or select an existing document from the sidebar to ask questions.",
    },
  ]);

  const [inputQuestion, setInputQuestion] = useState("");

  // Upload button state
  const [isUploading, setIsUploading] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);

  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);

  const [uploadProgress, setUploadProgress] = useState(0);
  // AUTO SCROLL CHAT
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, isStreaming]);

  // FETCH DOCUMENTS
  useEffect(() => {
    const fetchDocuments = async () => {
      if (!token) {
        setIsFetchingDocs(false);
        return;
      }
      setIsFetchingDocs(true);
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/documents`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const docs = res.data.documents || res.data || [];
        setDocuments(docs);
        if (docs.length > 0) {
          const savedDocId = localStorage.getItem("selectedDocId");
          const matchedDoc = docs.find((d) => d._id === savedDocId);
          if (matchedDoc) {
            setSelectedDoc(matchedDoc);
          } else {
            setSelectedDoc(docs[0]);
            localStorage.setItem("selectedDocId", docs[0]._id);
          }
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
      } catch (err) {
        console.error("Error fetching documents:", err);

        setSelectedDoc(null);
      } finally {
        setIsFetchingDocs(false);
      }
    };

    fetchDocuments();
  }, [token]);
  // 🔥 REAL-TIME DOCUMENT PROGRESS POLLING
  useEffect(() => {
    if (!token) return;
    const processingDocs = documents.filter(
      (doc) => doc.status === "PENDING" || doc.status === "PROCESSING"
    );
    if (processingDocs.length === 0) {
      return;
    }
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/documents`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const latestDocs = res.data.documents || res.data || [];
        setDocuments(latestDocs);
        // Selected document ko bhi latest progress do
        setSelectedDoc((currentSelected) => {
          if (!currentSelected?._id) {
            return currentSelected;
          }
          const updatedSelected = latestDocs.find(
            (doc) => doc._id === currentSelected._id
          );
          return updatedSelected || currentSelected;
        });
        // Agar koi document INDEXED ho gaya
        const finishedDoc = latestDocs.find(
          (doc) =>
            doc.status === "INDEXED" &&
            processingDocs.some((oldDoc) => oldDoc._id === doc._id)
        );
        if (finishedDoc) {
          setIsUploading(false);
          // Agar wahi currently selected document hai
          setSelectedDoc((currentSelected) => {
            if (currentSelected?._id === finishedDoc._id) {
              return finishedDoc;
            }
            return currentSelected;
          });
        }
        // Agar processing fail ho gaya
        const failedDoc = latestDocs.find(
          (doc) =>
            doc.status === "FAILED" &&
            processingDocs.some((oldDoc) => oldDoc._id === doc._id)
        );
        if (failedDoc) {
          setIsUploading(false);
        }
      } catch (err) {
        console.error("Progress polling error:", err.message);
      }
    }, 700);

    return () => clearInterval(interval);
  }, [documents, token]);
  // CHAT HISTORY
  useEffect(() => {
    const fetchChatHistory = async () => {
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
        setMessages([]);
        const res = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/chat/history/${selectedDoc._id}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const historyMessages = res.data.messages || [];
        if (historyMessages.length > 0) {
          setMessages(historyMessages);
        } else {
          setMessages([
            {
              role: "ai",
              text: "Hello! You can ask questions about this document.",
            },
          ]);
        }
      } catch (err) {
        console.error("Error fetching chat history:", err);
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

  // SAVE SELECTED DOCUMENT
  useEffect(() => {
    if (selectedDoc) {
      localStorage.setItem("lastSelectedDoc", JSON.stringify(selectedDoc));
      localStorage.setItem("selectedDocId", selectedDoc._id);
    }
  }, [selectedDoc]);

  // LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("selectedDoc");
    localStorage.removeItem("selectedDocId");
    localStorage.removeItem("lastSelectedDoc");
    setUser(null);
    setSelectedDoc(null);
    setDocuments([]);
    setToken("");
  };
  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      const expiryTime = payload.exp * 1000;
      const timeLeft = expiryTime - Date.now();

      if (timeLeft <= 0) {
        handleLogout();
        return;
      }

      const timer = setTimeout(() => {
        handleLogout();
      }, timeLeft);

      return () => clearTimeout(timer);
    } catch (error) {
      console.error("Invalid token:", error);
      handleLogout();
    }
  }, [token]);

  // LOGIN SUCCESS
  const handleLoginSuccess = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    setSelectedDoc(null);
    localStorage.removeItem("selectedDoc");
    localStorage.removeItem("selectedDocId");
    setMessages([
      {
        role: "ai",
        text: "Hello! Upload a PDF or select an existing document from the sidebar to ask questions.",
      },
    ]);
  };

  // 🔥 FILE UPLOAD
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setIsUploading(true);
      // Progress modal start
      setUploadProgress(0);
      // 1️⃣ File upload
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
      // 2️⃣ Immediately document UI mein add karo
      setDocuments((prev) => [newDoc, ...prev]);
      setSelectedDoc(newDoc);
      setIsMobileSidebarOpen(false);
      // 3️⃣ Backend processing progress check karo
      const checkProgress = async () => {
        try {
          const progressRes = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/documents/${newDoc._id}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            }
          );
          const doc = progressRes.data.document;
          // Backend ka actual progress
          setUploadProgress(doc.progress || 0);
          // Document processing complete
          if (doc.status === "INDEXED") {
            setUploadProgress(100);
            // Latest document state
            setDocuments((prev) =>
              prev.map((item) => (item._id === doc._id ? doc : item))
            );
            setSelectedDoc(doc);
            // Thoda delay taaki 100% visually dikhe
            setTimeout(() => {
              setIsUploading(false);
              setMessages([
                {
                  role: "ai",
                  text: `Document **${file.name}** uploaded and indexed successfully! You can ask questions now.`,
                },
              ]);
            }, 500);
            return;
          }
          // Processing fail
          if (doc.status === "FAILED") {
            setIsUploading(false);
            setUploadProgress(0);
            alert("Document processing failed.");
            return;
          }
          // Abhi processing chal rahi hai → dobara check
          setTimeout(checkProgress, 500);
        } catch (error) {
          console.error("Progress check error:", error);
          setTimeout(checkProgress, 1000);
        }
      };
      // 4️⃣ Progress polling start
      checkProgress();
    } catch (err) {
      console.error("Upload error:", err);
      alert(err.response?.data?.message || "File upload failed");
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // SEND CHAT MESSAGE
  const handleSendMessage = async () => {
    if (!inputQuestion.trim()) return;
    if (!selectedDoc) {
      alert("Please select or upload a document first!");
      return;
    }
    // Processing document par question mat bhejo
    if (
      selectedDoc.status === "PENDING" ||
      selectedDoc.status === "PROCESSING"
    ) {
      alert("Please wait until the document finishes processing.");
      return;
    }
    if (selectedDoc.status === "FAILED") {
      alert("This document failed to process. Please upload it again.");
      return;
    }
    const questionText = inputQuestion;
    setInputQuestion("");
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text: questionText,
      },
    ]);
    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: "",
      },
    ]);
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
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;
        // console.log("🔥 FRONTEND CHUNK:", new TextDecoder().decode(value));
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          const line = event.trim();

          if (!line.startsWith("data:")) continue;

          const data = line.replace(/^data:\s*/, "");

          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === "text" && parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];

                const lastIndex = updated.length - 1;

                updated[lastIndex] = {
                  ...updated[lastIndex],
                  text: updated[lastIndex].text + parsed.text,
                };

                return updated;
              });
            }
            if (parsed.type === "sources" && parsed.sources) {
              setMessages((prev) => {
                const updated = [...prev];
                const lastIndex = updated.length - 1;

                updated[lastIndex] = {
                  ...updated[lastIndex],
                  sources: parsed.sources,
                };

                return updated;
              });
            }

            if (parsed.type === "error") {
              throw new Error(parsed.error);
            }
          } catch (error) {
            console.error("❌ SSE Parse Error:", error);
          }
        }
      }
    } catch (err) {
      console.error("Chat streaming error:", err);
      setMessages((prev) => {
        const updated = [...prev];

        const lastIndex = updated.length - 1;

        updated[lastIndex] = {
          ...updated[lastIndex],
          text: "Error generating response. Please try again.",
        };

        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // DELETE DOCUMENT
  const handleDeleteDocument = async (e, docId) => {
    e.stopPropagation();

    const previousDocs = [...documents];

    const previousSelectedDoc = selectedDoc;

    const updatedDocs = documents.filter((doc) => doc._id !== docId);

    setDocuments(updatedDocs);

    if (selectedDoc?._id === docId) {
      if (updatedDocs.length > 0) {
        setSelectedDoc(updatedDocs[0]);

        localStorage.setItem("selectedDocId", updatedDocs[0]._id);
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

    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/documents/${docId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
    } catch (err) {
      console.error("Error deleting document:", err);

      alert("Failed to delete document. Rolling back changes.");

      setDocuments(previousDocs);
      setSelectedDoc(previousSelectedDoc);
    }
  };

  // CLEAR CHAT
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
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

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

  // AUTH SCREEN
  if (!token) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} />;
  }

  // MAIN UI
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

      {/* MOBILE OVERLAY */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity"
        ></div>
      )}

      {/* SIDEBAR */}
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
      <UploadProgressModal
        isUploading={isUploading}
        progress={uploadProgress}
      />

      {/* MAIN WORKSPACE */}
      <main className="flex-1 ml-0 md:ml-[280px] flex flex-col h-[100dvh] relative z-10 overflow-hidden">
        {/* HEADER */}
        <Header
          selectedDoc={selectedDoc}
          setIsMobileSidebarOpen={setIsMobileSidebarOpen}
          handleClearChat={handleClearChat}
        />

        {/* CHAT */}
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
                <div className="flex gap-3 md:gap-4 w-full max-w-full items-start">
                  <div className="w-8 h-8 rounded-lg bg-[#8083ff] flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(192,193,255,0.2)] mt-0.5">
                    <span className="material-symbols-outlined text-[#1000a9] text-[18px]">
                      auto_awesome
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 pt-0.5 min-h-[32px] justify-center min-w-0 flex-1">
                    <div className="text-sm text-[#e5e1e4] leading-relaxed prose prose-invert max-w-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2">
                      {/* 🔥 AI THINKING / LOADING */}
                      {isStreaming &&
                      idx === messages.length - 1 &&
                      msg.text === "" ? (
                        <AITypingLoader />
                      ) : (
                        <>
                          {/* AI RESPONSE */}
                          <ReactMarkdown>{msg.text}</ReactMarkdown>

                          {/* 📄 SOURCE PAGES */}
                          {msg.sources?.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2 w-full md:flex md:flex-wrap md:gap-2">
                              {msg.sources.map((source, sourceIndex) => (
                                <span
                                  key={sourceIndex}
                                  className="
          w-full
          min-w-0
          md:w-auto
          md:min-w-0
          text-[11px] sm:text-xs
          px-2.5 py-1
          rounded-lg
          bg-white/5
          border border-white/10
          text-[#c7c4d7]
          text-center
          whitespace-nowrap
        "
                                >
                                  📄 {selectedDoc?.name || "Document"} · Page{" "}
                                  {source.page}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* 🔥 STREAMING CURSOR */}
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

        {/* CHAT INPUT */}
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
