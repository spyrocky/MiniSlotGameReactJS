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

// Helper to pick random symbol name
function randSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

// Assign texture + store symbol name in sprite
function setSpriteSymbol(sprite, key) {
  sprite.__symbol = key; // store clean name
  const tex = PIXI.Texture.from(`/assets/${key}.png`);
  sprite.texture = tex;

  // Scale to fit cell
  const TARGET = SYMBOL_SIZE * 0.8;
  const applyScale = () => {
    const orig = sprite.texture.orig;
    const scale = Math.min(TARGET / orig.width, TARGET / orig.height);
    sprite.scale.set(scale);
  };

  if (tex.baseTexture.valid) applyScale();
  else tex.baseTexture.once("loaded", applyScale);
}

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
        const sprite = new PIXI.Sprite(); // empty, we’ll set texture via helper
        sprite.anchor.set(0.5);
        sprite.x = 0;
        sprite.y = row * SYMBOL_SIZE + SYMBOL_SIZE / 2;

        setSpriteSymbol(sprite, randSymbol());   // <— sets texture + __symbol + scale
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
    reelsRef.current.forEach((reel, i) => {
      reel.spinning = true;
      reel.position = 0;
      reel.target = 20 + i * 5 + Math.floor(Math.random() * 10);
    });

    appRef.current.ticker.add(updateSpin);
  }

  function updateSpin() {
    let spinning = false;
    reelsRef.current.forEach((reel) => {
      if (reel.spinning) {
        spinning = true;
        reel.position += 0.3;

        if (reel.position >= reel.target) {
          reel.spinning = false;
          reel.position = reel.target;
        }

        reel.sprites.forEach((sprite, j) => {
          sprite.y = ((j * SYMBOL_SIZE + reel.position * SYMBOL_SIZE) % (ROWS * SYMBOL_SIZE)) + SYMBOL_SIZE / 2;
          if (sprite.y < 0) {
            sprite.y += ROWS * SYMBOL_SIZE;
            setSpriteSymbol(sprite, randSymbol());
          }
        });
      }
    });

    if (!spinning) {
      appRef.current.ticker.remove(updateSpin);
      onSpinEnd && onSpinEnd();
    }
  }

  // ✅ Correct result grid: sort by y to match visible order
  function getResult() {
    const rows = [[], [], []]; // top, middle, bottom
    reelsRef.current.forEach((reel) => {
      const ordered = [...reel.sprites].sort((a, b) => a.y - b.y);
      rows[0].push(ordered[0].__symbol);
      rows[1].push(ordered[1].__symbol);
      rows[2].push(ordered[2].__symbol);
    });
    return rows;
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
