import React, { useState, useEffect, useRef } from "react";
import './ChatBot.css';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const ChatBot = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => {
  const saved = localStorage.getItem("chat_messages");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("chat_messages", JSON.stringify(messages));
  }, [messages]);

  const [listening, setListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [abortTyping, setAbortTyping] = useState(false);
  const [audio, setAudio] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [currentMessage, setCurrentMessage] = useState("");
  const [theme, setTheme] = useState("dark");
  const [ showPopup, setShowPopup ] = useState(true)

  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);


  useEffect(() => {
    document.body.classList.remove("light", "dark");
    document.body.classList.add(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const detectLanguage = (text) => {
    const malayalamRegex = /[\u0D00-\u0D7F]/;
    return malayalamRegex.test(text) ? "ml-IN" : "en-US";
  };


  const sendMessage = async (textOverride = null, voiceOnly = false) => {
    const userMessage = (textOverride || input).trim();
    if (!userMessage || isFetching) return;

    if (
      userMessage.toLowerCase().includes("who made you") ||
      userMessage.toLowerCase().includes("who make you") ||
      userMessage.toLowerCase().includes("who built you") ||
      userMessage.toLowerCase().includes("developer") ||
      userMessage.toLowerCase().includes("your creator") ||
      userMessage.includes("നിന്നെ ആരാ നിർമ്മിച്ചത്") ||  // Malayalam: who created you
      userMessage.includes("നിന്നെ ആരാ ഉണ്ടാക്കിയത്")    // Malayalam: who made you
    ) {
      const reply =
        `My creator is Mathew V J.
        Fullstack developer [Github](https://github.com/mathewvj). 
        Follow on [Instagram](https://www.instagram.com/mathew.v_j?igsh=a3Rva25rN3lwY3E=)."`
      setMessages((prev) => [...prev, { type: "bot", text: reply }]);
      handleVoiceOutput("My creator is Mathew. The fullstack developer. Check the links on screen.", "en-US");
      setIsFetching(false);
      setInput("")
      return;
    }


    const userLang = detectLanguage(userMessage);

    setMessages((prev) => [...prev, { type: "user", text: userMessage }]);
    setInput("");
    setIsFetching(true);

    try {
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, language: userLang }),
      });

      const data = await res.json();
      const botReply = data.reply;

      if (!voiceOnly) {
        setMessages((prev) => [...prev, { type: "bot", text: "" }]);
        setCurrentMessage(botReply);
        typeMessage(botReply, userLang);
      }

      handleVoiceOutput(botReply, userLang);
    } catch (err) {
      console.error("Error:", err);
      setMessages((prev) => [
        ...prev,
        { type: "bot", text: "⚠️ Could not reach the server." },
      ]);
    } finally {
      setIsFetching(false);
    }
  };

  const typeMessage = async (text, lang) => {
    setIsTyping(true);
    setAbortTyping(false);

    let currentText = "";

    for (let i = 0; i < text.length; i++) {
      if (abortTyping) {
        break;
      }

      currentText += text[i];
      setMessages((prev) => {
        const last = [...prev];
        last[last.length - 1] = { type: "bot", text: currentText };
        return last;
      });

      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    setMessages((prev) => {
      const last = [...prev];
      last[last.length - 1] = { type: "bot", text };
      return last;
    });

    setIsTyping(false);
  };

  const handleVoiceInput = () => {
    if (!SpeechRecognition) {
      alert("Your browser doesn't support voice recognition");
      return;
    }

    setShowPopup(false)
    setTimeout(() => {
      setShowPopup(true)
    }, 3000);

    const recognition = new SpeechRecognition();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = "ml-IN";

    recognition.onstart = () => {
      setListening(true);
      console.log("Voice recognition started");
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("Voice input:", transcript);
      setInput(transcript);
      sendMessage(transcript);
    };

    recognition.onerror = (e) => {
      console.error("Speech recognition error", e);
      alert("Speech recognition error");
    };

    recognition.onend = () => {
      setListening(false);
      console.log("Voice recognition ended");
    };

    recognition.start();
  };

  const handleVoiceOutput = (text, lang) => {
    const cleanText = text.replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}]/gu,
      ""
    );
    playVoice(cleanText, lang);
  };

  const playVoice = async (text, lang) => {
    try {
      const res = await fetch("http://localhost:5000/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: lang }),
      });

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const newAudio = new Audio(audioUrl);

      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }

      setAudio(newAudio);
      newAudio.play();
    } catch (error) {
      console.error("Failed to play voice:", error);
    }
  };

  const stopTyping = () => {
    setAbortTyping(true);
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };

  const readLastResponse = () => {
    const lastBot = messages.slice().reverse().find((msg) => msg.type === "bot");
    if (lastBot) {
      const lang = detectLanguage(lastBot.text);
      handleVoiceOutput(lastBot.text, lang);
    }
  };

  const formatMessage = (text) => {
    return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  };

  return (
    <div className="chat-container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1>🤖 AI Maathan</h1>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
        </button>
        <button
          onClick={() => {
            setMessages([]);
            localStorage.removeItem("chat_messages");
          }}
        >
          🗑️ Clear Chat
        </button>
      </div>
      
      <div className="chat-box">
        {messages.map((msg, idx) => (
          <p key={idx} className={msg.type}>
            {msg.type === "bot"
      ? <span dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
      : msg.text}
          </p>
        ))}
        {isTyping && (
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        <div ref={bottomRef}></div>
      </div>

      <div className="input-group">
        <input
          type="text"
          placeholder="Type your message here..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <div className="input-buttons">
             <div className="mic-container">
              {showPopup && (
                <div className="mic-popup">
                  🗣️ Talk in Malayalam...
                </div>
              )}
              <button 
                className="voice-btn btn-icon" 
                onClick={handleVoiceInput} 
                disabled={listening || isFetching}
                title="Voice input"
              >
                🎤
              </button>
            </div>
          <button 
            className="send-btn" 
            onClick={() => sendMessage()} 
            disabled={isFetching || listening || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>

      <div className="control-buttons">
        <button onClick={stopTyping} disabled={!isTyping}>
          ⏹ Stop
        </button>
        <button onClick={readLastResponse}>
          🔊 Read Last Response
        </button>
      </div>
    </div>
  );
};

export default ChatBot;