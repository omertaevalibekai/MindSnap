import { useEffect, useRef, useState } from "react";

export const QuickPopup = () => {
  const [error, setError] = useState("");
  const openedRef = useRef(false);

  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;

    const open = async (): Promise<void> => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          setError("Active tab not found.");
          return;
        }
        await chrome.sidePanel.open({ tabId: tab.id });
        window.close();
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "Failed to open side panel.");
      }
    };

    void open();
  }, []);

  return (
    <main style={{ width: 320, padding: 12, background: "#0b1121", color: "#e2e8f0", fontFamily: "'Source Sans 3', sans-serif" }}>
      <h1 style={{ fontFamily: "Outfit, sans-serif", marginTop: 0 }}>MindSnap</h1>
      <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>{error || "Opening side panel..."}</p>
    </main>
  );
};

