import React, { useRef, useState } from "react";
import GameCanvas from "./GameCanvas";

// Simple payout table for the demo:
// - any horizontal row match = +30 credits
// - any diagonal match       = +50 credits
// You can tweak these values anytime.
const PAYOUTS = {
  row: 30,
  diag: 50,
};

export default function App() {
  const gameRef = useRef(null);       // ref to call methods exposed by GameCanvas
  const [credits, setCredits] = useState(100);
  const [spinning, setSpinning] = useState(false);

  const handleSpin = () => {
    // Prevent spam clicks + ensure player can afford the bet.
    if (spinning) return;
    if (credits < 10) {
      alert("Not enough credits. (Bet is 10.)");
      return;
    }

    // 1) Deduct bet
    setCredits((c) => c - 10);

    // 2) Clear any old highlights in the canvas
    gameRef.current?.highlightPaylines([]);

    // 3) Start the animation in Pixi
    setSpinning(true);
    gameRef.current?.spinReels();
  };

  const handleSpinEnd = () => {
    // Called by GameCanvas AFTER the last reel has finished spinning.
    // 1) Read the visible 3x3 grid of symbols from Pixi
    const result = gameRef.current?.getResult(); // [["cherry","lemon","bar"],["..."],["..."]]
    if (!result) {
      setSpinning(false);
      return;
    }

    let totalWin = 0;
    const winningLines = []; // we push descriptors like { type:"row", row:0 } or { type:"diag1" }

    // 2) Check horizontal paylines (top, middle, bottom)
    for (let row = 0; row < 3; row++) {
      const a = result[row][0];
      const b = result[row][1];
      const c = result[row][2];
      if (a === b && b === c) {
        totalWin += PAYOUTS.row;
        winningLines.push({ type: "row", row });
      }
    }

    // 3) Check diagonals
    // ↘ diagonal (top-left to bottom-right)
    if (result[0][0] === result[1][1] && result[1][1] === result[2][2]) {
      totalWin += PAYOUTS.diag;
      winningLines.push({ type: "diag1" });
    }
    // ↙ diagonal (top-right to bottom-left)
    if (result[0][2] === result[1][1] && result[1][1] === result[2][0]) {
      totalWin += PAYOUTS.diag;
      winningLines.push({ type: "diag2" });
    }

    // 4) If there are wins, add credits and highlight lines inside Pixi
    if (totalWin > 0) {
      setCredits((c) => c + totalWin);
      gameRef.current?.highlightPaylines(winningLines);
      // Pixi will also play the "win" sound (see GameCanvas)
      alert(`🎉 You win ${totalWin} credits!`);
    } else {
      // No win → ensure highlights are cleared
      gameRef.current?.highlightPaylines([]);
    }

    // 5) Re-enable the Spin button
    setSpinning(false);
  };

  return (
    <div style={{ textAlign: "center", height: "100%" }}>
      <h1 style={{ marginTop: 16 }}>🎰 React + Pixi Slot</h1>
      <p style={{ margin: 0 }}>Credits: <b>{credits}</b></p>
      <p style={{ marginTop: 8, opacity: 0.7 }}>Bet per spin: 10</p>

      <button
        onClick={handleSpin}
        disabled={spinning}
        style={{
          padding: "10px 24px",
          fontSize: 18,
          borderRadius: 8,
          border: "1px solid #444",
          background: spinning ? "#333" : "#1f6feb",
          color: "white",
        }}
      >
        {spinning ? "Spinning..." : "Spin"}
      </button>

      {/* Game canvas below. We pass a callback for when spinning finishes. */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        <GameCanvas ref={gameRef} onSpinEnd={handleSpinEnd} />
      </div>
    </div>
  );
}
