import React, { useState, useRef } from "react";
import axios from "axios";
import VoiceWaveform from "./VoiceWaveform";

export default function ChatInput({
  selectedDoc,
  fileInputRef,
  inputQuestion,
  setInputQuestion,
  handleSendMessage,
  isStreaming,
}) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // 1. Universal MediaRecorder Start (Mobile + Laptop Cross-Platform Support)
  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsListening(true);
    } catch (err) {
      console.error("Microphone access error:", err);
      alert("Microphone permission denied or not supported.");
    }
  };

  // 2. Stop & Send Audio to Groq Backend for Transcription
  const stopListening = () => {
    if (!mediaRecorderRef.current) return;

    setIsListening(false);
    setIsTranscribing(true);

    mediaRecorderRef.current.onstop = async () => {
      // Release mic hardware icon
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());

      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current.mimeType || "audio/webm",
      });

      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/transcribe`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
          }
        );

        if (res.data?.text) {
          setInputQuestion((prev) =>
            prev ? `${prev} ${res.data.text}` : res.data.text
          );
        }
      } catch (err) {
        console.error("Transcription Error:", err);
        alert("Voice transcription failed. Please try again.");
      } finally {
        setIsTranscribing(false);
      }
    };

    mediaRecorderRef.current.stop();
  };

  // 3. Cancel Recording
  const cancelListening = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    setIsTranscribing(false);
    audioChunksRef.current = [];
  };

  // Mic Sound
  const playMicSound = (frequency = 700) => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    const audioContext = new AudioContext();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);

    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.18
    );

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.18);
  };

  return (
    <div className="absolute bottom-2 md:bottom-6 left-0 right-0 px-3 md:px-6 flex justify-center z-40 pointer-events-none">
      <div className="w-full max-w-3xl glass-floating rounded-2xl p-2 md:p-2.5 flex flex-col shadow-2xl pointer-events-auto bg-[#131315]/90 backdrop-blur-xl border border-white/10">
        {/* Selected Document Badge */}
        {selectedDoc && (
          <div className="px-3 pt-1 pb-1.5 flex gap-2 overflow-x-auto no-scrollbar">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#201f22] text-[#c7c4d7] text-[11px] border border-white/5 whitespace-nowrap">
              <span className="material-symbols-outlined text-[12px]">
                picture_as_pdf
              </span>
              @{selectedDoc.originalName || selectedDoc.fileName}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 px-1 min-h-[44px]">
          {/* =========================
          Voice Waveform
      ========================= */}
          {isListening || isTranscribing ? (
            <VoiceWaveform
              isListening={isListening}
              isTranscribing={isTranscribing}
              onStop={() => {
                // 🔊 Done / Stop sound
                playMicSound(500);

                stopListening();
              }}
              onCancel={cancelListening}
            />
          ) : (
            <>
              {/* =========================
              PDF File Attach Icon
          ========================= */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#c7c4d7] hover:text-[#c0c1ff] rounded-xl hover:bg-[#201f22] transition-colors shrink-0 flex items-center justify-center"
                title="Attach PDF Document"
              >
                <span className="material-symbols-outlined text-[20px]">
                  attach_file
                </span>
              </button>

              {/* =========================
              Mic Icon
          ========================= */}
              <button
                type="button"
                onClick={() => {
                  // 🔊 Mic start sound
                  playMicSound(700);

                  startListening();
                }}
                className="p-2 text-[#c7c4d7] hover:text-[#c0c1ff] hover:bg-[#201f22] rounded-xl transition-all shrink-0 flex items-center justify-center"
                title="Voice Input (Mic)"
              >
                <span className="material-symbols-outlined text-[20px]">
                  mic
                </span>
              </button>

              {/* =========================
              Text Area
          ========================= */}
              <textarea
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                style={{ fontSize: "16px" }}
                className="flex-1 bg-transparent border-none focus:ring-0 text-white text-base md:text-sm resize-none py-1.5 px-2 max-h-28 placeholder-[#908fa0] leading-normal outline-none"
                placeholder="Ask anything or speak..."
                rows="1"
              />

              {/* =========================
              Send Button
          ========================= */}
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={isStreaming || !inputQuestion.trim()}
                className="p-2.5 bg-[#494bd6] text-white rounded-xl hover:bg-[#8083ff] transition-all shrink-0 disabled:opacity-40 flex items-center justify-center"
                title="Send Message"
              >
                <span className="material-symbols-outlined text-[18px]">
                  send
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
