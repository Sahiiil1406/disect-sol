import { useState } from "react";
import { createRoot } from "react-dom/client";

function Popup() {
  const [status, setStatus] = useState("");

  const handleSave = async () => {
    const lastSavedAt = new Date().toISOString();

    await chrome.storage.local.set({ lastSavedAt });
    setStatus(`Saved at ${new Date(lastSavedAt).toLocaleTimeString()}`);
  };

  return (
    <main className="popup-shell">
      <h1>React Chrome Extension</h1>
      <p>Popup UI is powered by React.</p>
      <button type="button" onClick={handleSave}>
        Save Timestamp
      </button>
      <div className="status">{status}</div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<Popup />);
