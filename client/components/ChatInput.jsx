import React, { useRef, useState, useEffect } from "react";
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
  const isStartingRef = useRef(false);

  // ==========================================
  // 🔊 PERSISTENT AUDIO CONTEXT (fixes double/choppy beep)
  // ==========================================
  // Root cause of the original bug:
  //  1. A brand-new AudioContext was created AND destroyed on every single
  //     beep. Creating/closing AudioContext is an expensive, async
  //     operation. If a second context started initializing before the
  //     first one had fully finished closing (which is very likely right
  //     after stopListening(), because getUserMedia's mic teardown and the
  //     AudioContext teardown compete for the same audio hardware/session),
  //     the browser would briefly run two overlapping audio graphs. That
  //     overlap is what produced the "double / tuaa" / choppy sound —
  //     it was NOT one beep, it was two beeps (old context tail + new
  //     context) fighting each other.
  //  2. The gain envelope jumped straight to 0.5 with no attack ramp, so
  //     the oscillator started with an instant amplitude jump. That
  //     produces an audible "click" transient right before the tone,
  //     which on its own can sound like "tun-tuaa" (click + tone) even
  //     without any overlap.
  //  3. oscillator.stop() was scheduled at the exact same time the gain
  //     ramp reached (asymptotically) zero, so the oscillator could be
  //     cut off before it was actually silent, causing a small pop.
  //
  // Fix:
  //  - Reuse ONE AudioContext for the whole component lifetime (create it
  //    lazily on first use, resume() if suspended — never create a second
  //    one, never close it between beeps). This removes the create/close
  //    race entirely and is the most reliable pattern across Chrome
  //    desktop/mobile and Safari.
  //  - Use a short attack + exponential release envelope so there is no
  //    instant amplitude jump (no click) and the tone decays cleanly to
  //    silence before oscillator.stop() is called.
  //  - Guard with a ref flag so a beep can never overlap itself even if a
  //    click fires twice in quick succession.
  //  - The beep is generated purely through Web Audio's own destination
  //    (speakers). It is never connected to the MediaRecorder's input
  //    stream, so it can never end up inside the recorded/transcribed
  //    audio.
  const audioCtxRef = useRef(null);
  const isBeepPlayingRef = useRef(false);

  const getAudioContext = () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
      audioCtxRef.current = new AudioContextClass();
    }
    return audioCtxRef.current;
  };

  const playMicSound = (frequency = 1000) => {
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      // Required on some browsers (esp. mobile Safari/Chrome) if the
      // context was auto-suspended (e.g. tab backgrounded).
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      // Never let two beeps overlap.
      if (isBeepPlayingRef.current) return;
      isBeepPlayingRef.current = true;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      const now = ctx.currentTime;
      const attack = 0.005; // seconds, tiny ramp-up to avoid a click
      const hold = 0.09; // seconds, audible tone length
      const release = 0.05; // seconds, tail to reach silence cleanly

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.5, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + hold);

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      oscillator.start(now);
      oscillator.stop(now + attack + hold + release);

      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        isBeepPlayingRef.current = false;
      };
    } catch (error) {
      console.error("Sound error:", error);
      isBeepPlayingRef.current = false;
    }
  };

  // Close the shared AudioContext only when the component actually
  // unmounts — never between individual beeps.
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // ==========================================
  // 🎙️ START LISTENING
  // ==========================================
  const startListening = async () => {
    if (isStartingRef.current) return;

    // Agar previous recording/transcription abhi chal rahi hai
    if (isListening || isTranscribing) return;

    isStartingRef.current = true;

    try {
      // 🔊 Sound FIRST — called synchronously, before any `await`, so the
      // browser still treats this as tied to the user's click gesture
      // (important for autoplay/audio policies on mobile browsers).
      playMicSound(1300);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      audioChunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
      });

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
    } finally {
      isStartingRef.current = false;
    }
  };

  // ==========================================
  // 🛑 STOP LISTENING + TRANSCRIBE
  // ==========================================
  const stopListening = () => {
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder) return;

    // Recording state off
    setIsListening(false);
    setIsTranscribing(true);

    mediaRecorder.onstop = async () => {
      // ==========================================
      // 🎙️ FIRST: MIC COMPLETELY STOP
      // ==========================================
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());

      // ==========================================
      // 🔊 NOW: DONE SOUND
      // ==========================================
      // Played AFTER the mic tracks are stopped and using the SAME
      // persistent AudioContext, so it can't collide with the mic's
      // audio session and can't leak into the already-captured chunks
      // (audioChunksRef was filled before this point, from the
      // `ondataavailable` events — this beep is generated after
      // recording has fully ended, so it is never part of the blob).
      playMicSound(1000);

      // ==========================================
      // 🎧 CREATE AUDIO
      // ==========================================
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorder.mimeType || "audio/webm",
      });

      const formData = new FormData();

      formData.append("audio", audioBlob, "recording.webm");

      try {
        const res = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/transcribe`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
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

        audioChunksRef.current = [];

        mediaRecorderRef.current = null;
      }
    };

    // ==========================================
    // 🛑 ONLY STOP HERE
    // ==========================================
    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  };

  // ==========================================
  // ❌ CANCEL RECORDING
  // ==========================================
  const cancelListening = () => {
    const mediaRecorder = mediaRecorderRef.current;

    if (mediaRecorder) {
      // Stop microphone
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());

      // Stop recorder only if active
      if (mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }

      mediaRecorderRef.current = null;
    }

    audioChunksRef.current = [];

    setIsListening(false);
    setIsTranscribing(false);
  };

  return (
    <div className="absolute bottom-2 md:bottom-6 left-0 right-0 px-3 md:px-6 flex justify-center z-40 pointer-events-none">
      <div className="w-full max-w-3xl glass-floating rounded-2xl p-2 md:p-2.5 flex flex-col shadow-2xl pointer-events-auto bg-[#131315]/90 backdrop-blur-xl border border-white/10">
        {/* ==========================================
            SELECTED DOCUMENT
        ========================================== */}
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
          {/* ==========================================
              VOICE MODE
          ========================================== */}
          {isListening || isTranscribing ? (
            <VoiceWaveform
              isListening={isListening}
              isTranscribing={isTranscribing}
              onStop={stopListening}
              onCancel={cancelListening}
            />
          ) : (
            <>
              {/* ==========================================
                  ATTACH PDF
              ========================================== */}
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

              {/* ==========================================
                  MIC
              ========================================== */}
              <button
                type="button"
                onClick={startListening}
                className="p-2 text-[#c7c4d7] hover:text-[#c0c1ff] hover:bg-[#201f22] rounded-xl transition-all shrink-0 flex items-center justify-center"
                title="Voice Input (Mic)"
              >
                <span className="material-symbols-outlined text-[20px]">
                  mic
                </span>
              </button>

              {/* ==========================================
                  TEXT AREA
              ========================================== */}
              <textarea
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                style={{
                  fontSize: "16px",
                }}
                className="flex-1 bg-transparent border-none focus:ring-0 text-white text-base md:text-sm resize-none py-1.5 px-2 max-h-28 placeholder-[#908fa0] leading-normal outline-none"
                placeholder="Ask anything or speak..."
                rows="1"
              />

              {/* ==========================================
                  SEND
              ========================================== */}
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
