import React, { useRef, useState } from "react";
import GameCanvas from "./GameCanvas";
import { sound } from "@pixi/sound";


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
  const [winMessages, setWinMessages] = useState([]);


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
  const result = gameRef.current?.getResult();
  if (!result) {
    setSpinning(false);
    return;
  }

  let totalWin = 0;
  const winningLines = [];
  const messages = [];

  // 🔹 Check horizontal rows
  for (let row = 0; row < 3; row++) {
    const [a, b, c] = result[row];

    if (a === b && b === c) {
      // Jackpot override → 7-7-7 pays 100 instead of 30
      if (a === "seven") {
        totalWin += PAYOUTS.jackpot;
        winningLines.push({ type: "row", row });
        messages.push(`🎰 JACKPOT! Row ${row + 1} with 7-7-7`);
      } else {
        totalWin += PAYOUTS.row;
        winningLines.push({ type: "row", row });
        messages.push(`Row ${row + 1} win with ${a}, ${b}, ${c}`);
      }
    }
  }

  // 🔹 Check diagonal ↘
  if (result[0][0] === result[1][1] && result[1][1] === result[2][2]) {
    if (result[0][0] === "seven") {
      totalWin += PAYOUTS.jackpot;
      winningLines.push({ type: "diag1" });
      messages.push("🎰 JACKPOT! Diagonal ↘ with 7-7-7");
    } else {
      totalWin += PAYOUTS.diag;
      winningLines.push({ type: "diag1" });
      messages.push(
        `Diagonal (↘) win with ${result[0][0]}, ${result[1][1]}, ${result[2][2]}`
      );
    }
  }

  // 🔹 Check diagonal ↙
  if (result[0][2] === result[1][1] && result[1][1] === result[2][0]) {
    if (result[0][2] === "seven") {
      totalWin += PAYOUTS.jackpot;
      winningLines.push({ type: "diag2" });
      messages.push("🎰 JACKPOT! Diagonal ↙ with 7-7-7");
    } else {
      totalWin += PAYOUTS.diag;
      winningLines.push({ type: "diag2" });
      messages.push(
        `Diagonal (↙) win with ${result[0][2]}, ${result[1][1]}, ${result[2][0]}`
      );
    }
  }

  // 🔹 Apply result
  if (totalWin > 0) {
    setCredits((c) => c + totalWin);
    gameRef.current?.highlightPaylines(winningLines);
    sound.play("win");
    setWinMessages([`🎉 You win ${totalWin} credits!`, ...messages]);
  } else {
    gameRef.current?.highlightPaylines([]);
    sound.play("lose");
    setWinMessages(["No win this time. Try again!"]);
  }

  // Re-enable spin button
  setSpinning(false);
};




  return (
    <div style={{ textAlign: "center", height: "100%" }}>
      <h1 style={{ marginTop: 20 }}>🎰 React + Pixi - Mini Slot Machine Game</h1>
      
     <div style={{
            display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          maxWidth: "600px",
          margin: "0 auto 20px auto",
           borderRadius: "10px",
            backgroundColor: "#1a1a1a",
            border: "2px solid #0af",
            padding: "15px",
          }}
        >
            <p style={{ margin: 8,fontSize: 18 }}>Credits: <b>{credits}</b></p>
            <p style={{ margin: 8, opacity: 0.7,fontSize: 18 }}>Bet per spin: 10</p>     

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

        </div>
      

 {/* ✅ Instructions panel */}
      <div
        style={{
          flex: 1,
          marginTop: "20px",
          padding: "15px",
          border: "2px solid gold",
          borderRadius: "10px",
          color: "white",
          backgroundColor: "#222",
          maxWidth: "600px",
          marginLeft: "auto",
          marginRight: "auto",
          textAlign: "left",
          fontFamily: "Arial",
        }}
      >
        <h3 style={{ color: "gold", textAlign: "center" }}>How It Works</h3>
        <ul>
          <li>Each spin costs <strong>10 credits</strong></li>
          <li>3 matching symbols on a row → <strong>+30 credits</strong></li>
          <li>3 matching symbols diagonally → <strong>+50 credits</strong></li>
          <li>
            Jackpot: <span style={{ color: "red" }}>7-7-7</span> →{" "}
            <strong>+100 credits</strong>
          </li>
        </ul>
      </div>

      {/* Win messages panel */}
<div
  style={{
    marginTop: "20px",
    padding: "15px",
    border: "2px solid #888",
    borderRadius: "10px",
    backgroundColor: "#111",
    maxWidth: "600px",
    marginLeft: "auto",
    marginRight: "auto",
    color: "white",
    textAlign: "center",
    fontFamily: "Arial"
  }}
>
  {winMessages.map((msg, i) => (
    <p key={i} style={{ margin: "5px 0", color: msg.includes("🎉") ? "gold" : "white" }}>
      {msg}
    </p>
  ))}
</div>


      {/* Game canvas below. We pass a callback for when spinning finishes. */}
      <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
        <GameCanvas ref={gameRef} onSpinEnd={handleSpinEnd} />       


      </div>

      
      

    </div>

    
  );
}
