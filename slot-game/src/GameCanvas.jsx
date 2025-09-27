import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as PIXI from "pixi.js";
import gsap from "gsap";
import { GlowFilter } from "@pixi/filter-glow";
import { sound } from "@pixi/sound";


const APP_W = 640;
const APP_H = 480;
const REELS = 3;
const ROWS = 3;
const SYMBOL_SIZE = 100;

const VIEWPORT = { x: 120, y: 80, width: 400, height: SYMBOL_SIZE * ROWS };
const columnWidth = VIEWPORT.width / REELS;
const reelCentersX = Array.from({ length: REELS }, (_, i) =>
  VIEWPORT.x + i * columnWidth + columnWidth / 2
);

const SYMBOLS = ["cherry", "lemon", "bar", "seven"];

const GameCanvas = forwardRef(({ onSpinEnd }, ref) => {
  const rootRef = useRef(null);
  const appRef = useRef(null);
  const reelsRef = useRef([]);
  const highlightLayerRef = useRef(null);
  const spinInstanceRef = useRef(null); // to track the spin sound instance

  useImperativeHandle(ref, () => ({
    spinReels,
    getResult,
    highlightPaylines,
  }));

  useEffect(() => {    

    // 1) Create Pixi application
    const app = new PIXI.Application({
      width: APP_W,
      height: APP_H,
      backgroundColor: 0x1a1e2b,
    });
    appRef.current = app;
    rootRef.current.appendChild(app.view);

    // Load sounds
    sound.add("spin", "/assets/sounds/spin.wav");
    sound.add("win", "/assets/sounds/win.mp3");
    sound.add("lose", "/assets/sounds/losing.mp3");


    // 2) Draw machine frame
    const frame = new PIXI.Graphics();
    frame.beginFill(0x0e1118);
    frame.drawRoundedRect(
      VIEWPORT.x - 20,
      VIEWPORT.y - 20,
      VIEWPORT.width + 40,
      VIEWPORT.height + 40,
      18
    );
    frame.endFill();
    app.stage.addChild(frame);

    // 3) Create reels
    const reels = [];
    for (let col = 0; col < REELS; col++) {
      const reelContainer = new PIXI.Container();
      reelContainer.x = reelCentersX[col];
      reelContainer.y = VIEWPORT.y;
      app.stage.addChild(reelContainer);

      const sprites = [];
      for (let row = 0; row < ROWS; row++) {
        const key = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const sprite = PIXI.Sprite.from(`/assets/${key}.png`);
        sprite.anchor.set(0.5);
        sprite.x = 0;
        sprite.y = row * SYMBOL_SIZE + SYMBOL_SIZE / 2;

        // ✅ Scale properly to fit inside 100px cell
        sprite.texture.baseTexture.once("loaded", () => {
          const target = SYMBOL_SIZE * 0.8;
          const orig = sprite.texture.orig;
          const scale = Math.min(target / orig.width, target / orig.height);
          sprite.scale.set(scale);
        });

        reelContainer.addChild(sprite);
        sprites.push(sprite);
      }

      reels.push({ container: reelContainer, sprites });
    }
    reelsRef.current = reels;

    // 4) Highlight layer
    const highlightLayer = new PIXI.Container();
    highlightLayer.zIndex = 10;
    app.stage.addChild(highlightLayer);
    app.stage.sortableChildren = true;
    highlightLayerRef.current = highlightLayer;

    return () => {
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    };
  }, []);

  // Spin reels
  function spinReels() {
// --- Start spin sound ---
  if (spinInstanceRef.current) {
    try { spinInstanceRef.current.stop(); } catch {}
  }
  spinInstanceRef.current = sound.play("spin", { loop: true, volume: 0.5 });



  reelsRef.current.forEach((reel, i) => {
    const symbols = reel.sprites;
    const totalSpins = 20 + i * 5; // spin longer for each reel
    let spins = 0;

    const spinOne = () => {
      // Move each symbol down
      symbols.forEach((sprite) => {
        sprite.y += SYMBOL_SIZE;
        if (sprite.y >= ROWS * SYMBOL_SIZE) {
          // Recycle symbol to top
          sprite.y -= ROWS * SYMBOL_SIZE;
          const key = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
          sprite.texture = PIXI.Texture.from(`/assets/${key}.png`);

          // rescale after texture change
          sprite.texture.baseTexture.once("loaded", () => {
            const target = SYMBOL_SIZE * 0.8;
            const orig = sprite.texture.orig;
            const scale = Math.min(target / orig.width, target / orig.height);
            sprite.scale.set(scale);
          });
        }
      });

      spins++;
      if (spins < totalSpins) {
        setTimeout(spinOne, 100); // control speed
      } else if (i === reelsRef.current.length - 1) {
         if (spinInstanceRef.current) {
            try {
              spinInstanceRef.current.stop();   // ✅ this cuts it instantly
            } catch (e) {
              console.warn("Error stopping spin sound:", e);
            }
            spinInstanceRef.current = null;
          }
          onSpinEnd?.();
        }
    };

    spinOne();
  });
}


  // Get current 3×3 grid of results
function getResult() {
  const rows = [[], [], []];

  reelsRef.current.forEach((reel) => {
    reel.sprites.forEach((sprite, row) => {
      // Take the texture ID (something like "/assets/seven.png")
      const id = sprite.texture.textureCacheIds[0];

      // Extract clean symbol name: "seven", "bar", "cherry", "lemon"
      let symbol = id;
      if (id.includes("/")) {
        symbol = id.split("/").pop().replace(".png", "");
      }
      rows[row].push(symbol);
    });
  });

  return rows; // [["seven","cherry","seven"],["bar","seven","cherry"],["cherry","bar","seven"]]
}


  // Highlight winning paylines
  function highlightPaylines(lines) {
    const layer = highlightLayerRef.current;
    if (!layer) return;
    layer.removeChildren();

    if (!lines || lines.length === 0) return;

    const rowCenter = (r) => VIEWPORT.y + r * SYMBOL_SIZE + SYMBOL_SIZE / 2;

    lines.forEach((line) => {
      const g = new PIXI.Graphics();
      g.lineStyle(6, 0xffd700, 0.95);
      g.filters = [new GlowFilter({ distance: 18, outerStrength: 3 })];

      if (line.type === "row") {
        const y = rowCenter(line.row);
        g.moveTo(reelCentersX[0] - columnWidth / 2 + 10, y);
        g.lineTo(reelCentersX[2] + columnWidth / 2 - 10, y);
      } else if (line.type === "diag1") {
        g.moveTo(reelCentersX[0] - columnWidth / 2 + 10, rowCenter(0));
        g.lineTo(reelCentersX[2] + columnWidth / 2 - 10, rowCenter(2));
      } else if (line.type === "diag2") {
        g.moveTo(reelCentersX[2] + columnWidth / 2 - 10, rowCenter(0));
        g.lineTo(reelCentersX[0] - columnWidth / 2 + 10, rowCenter(2));
      }

      layer.addChild(g);
    });
  }

  return <div ref={rootRef} />;
});

export default GameCanvas;
