import React, {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import * as PIXI from "pixi.js";        // Pixi core (v6)
import gsap from "gsap";                // Tweening / animations
import { sound } from "@pixi/sound";    // Audio playback
import { GlowFilter } from "@pixi/filter-glow"; // Nice glow for win lines

/**
 * Teaching note:
 *  - React controls the "game rules" (credits, when to spin, payout).
 *  - Pixi draws and animates graphics (reels, symbols, highlights).
 *  - We expose a tiny API from this component to React via ref:
 *      .spinReels()     -> start animation
 *      .getResult()     -> read the 3x3 symbols (for win checks)
 *      .highlightPaylines(lines) -> draw glowing lines for wins
 */

// ------- Layout constants (tweak to taste) -------
const APP_W = 640;
const APP_H = 480;

const REELS = 3;          // number of columns
const ROWS = 3;           // number of visible rows
const SYMBOL_SIZE = 100;  // height of each "row window" in pixels

// Visible window for the reels (a nice rounded rectangle)
const VIEWPORT = {
  x: 120,
  y: 80,
  width: 400,
  height: SYMBOL_SIZE * ROWS, // 300
};

// Positions of the reels: 3 columns evenly spaced inside the viewport
const columnWidth = VIEWPORT.width / REELS;
// the X coordinate of each reel's center
const reelCentersX = Array.from({ length: REELS }, (_, i) => (
  VIEWPORT.x + i * columnWidth + columnWidth / 2
));

// Available symbol names. We load images with these names.
const SYMBOLS = ["slotpic_cherry", "slotpic_lemon", "slotpic_bar", "slotpic_seven"];

const GameCanvas = forwardRef(function GameCanvas(props, ref) {
  const rootRef = useRef(null);      // div where Pixi will mount its <canvas>
  const appRef = useRef(null);       // PIXI.Application
  const reelsRef = useRef([]);       // [{ container, sprites: [PIXI.Sprite,...] }, ...]
  const highlightLayerRef = useRef(null); // container for glowing win lines
  const resourcesLoadedRef = useRef(false); // ensure we only init once

  // ----- Expose methods to React's parent component -----
  useImperativeHandle(ref, () => ({
    spinReels,
    getResult,
    highlightPaylines,
  }));

  // ----- Initialize Pixi only once -----
  useEffect(() => {
    // 1) Create the Pixi application (the <canvas>)
    const app = new PIXI.Application({
      width: APP_W,
      height: APP_H,
      backgroundColor: 0x1a1e2b,
      antialias: true,
    });
    appRef.current = app;
    rootRef.current.appendChild(app.view);

    // 2) Load images via Pixi's classic Loader (v6)
    //    We also add sounds separately via @pixi/sound (simpler).
    const loader = PIXI.Loader.shared;
    SYMBOLS.forEach((name) => loader.add(name, `/assets/${name}.png`));
    loader.load(() => setup(app)); // when textures are loaded -> setup

    // 3) Add sounds (no need to wait for loader)
    sound.add("spin", "/assets/sounds/spin sfx.mp3");
    sound.add("win", "/assets/sounds/win sfx.mp3");
    sound.add("lose", "/assets/sounds/losing sfx.mp3");

    return () => {
      // Clean up Pixi on unmount
      sound.stopAll();
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Build the scene (reels, mask, background, highlight layer) -----
  const setup = (app) => {
    if (resourcesLoadedRef.current) return;
    resourcesLoadedRef.current = true;

    // 1) Draw a nice "machine" frame / background
    const frame = new PIXI.Graphics();
    frame.beginFill(0x0e1118);
    frame.drawRoundedRect(VIEWPORT.x - 20, VIEWPORT.y - 20, VIEWPORT.width + 40, VIEWPORT.height + 40, 18);
    frame.endFill();
    app.stage.addChild(frame);

    // 2) Create a container to hold all reels
    const reelsRoot = new PIXI.Container();
    app.stage.addChild(reelsRoot);

    // 3) Add a rectangular mask so only the viewport area is visible
    const mask = new PIXI.Graphics();
    mask.beginFill(0xffffff);
    mask.drawRect(VIEWPORT.x, VIEWPORT.y, VIEWPORT.width, VIEWPORT.height);
    mask.endFill();
    reelsRoot.mask = mask;
    app.stage.addChild(mask); // mask must be on stage to be used

    // 4) Build each reel (a container with 3 sprites stacked vertically)
    const { resources } = PIXI.Loader.shared;
    const reels = [];

    for (let col = 0; col < REELS; col++) {
      const reelContainer = new PIXI.Container();
      // Place the reel container so that (0, 0) for its children is at the top-left of the viewport
      reelContainer.x = reelCentersX[col];
      reelContainer.y = VIEWPORT.y;
      app.stage.addChild(reelContainer);
      reelsRoot.addChild(reelContainer);

      // Create 3 symbol sprites (top/middle/bottom) inside this reel
      const sprites = [];
      for (let row = 0; row < ROWS; row++) {
        // Pick a random symbol to start
        const key = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
        const sprite = new PIXI.Sprite(resources[key].texture);

        // Center anchor (so scaling/rotation is around the center)
        sprite.anchor.set(0.5);

        // Every row has a "center Y" line inside the viewport:
        //   row 0 center: VIEWPORT.y + SYMBOL_SIZE/2
        //   row 1 center: VIEWPORT.y + SYMBOL_SIZE/2 + SYMBOL_SIZE
        //   row 2 center: VIEWPORT.y + SYMBOL_SIZE/2 + SYMBOL_SIZE*2
        // We offset by reel container (which sits at VIEWPORT.y)
        sprite.x = 0; // horizontally centered on the reel
        sprite.y = row * SYMBOL_SIZE + SYMBOL_SIZE / 2;

        // Scale the symbol to fit nicely within the row cell (80% of the row height)
        const target = SYMBOL_SIZE * 0.8;
        const scale = Math.min(target / sprite.texture.width, target / sprite.texture.height);
        sprite.scale.set(scale);

        reelContainer.addChild(sprite);
        sprites.push(sprite);
      }

      reels.push({ container: reelContainer, sprites });
    }

    reelsRef.current = reels;

    // 5) A layer on top to draw glowing winning lines
    const highlightLayer = new PIXI.Container();
    highlightLayer.zIndex = 10;
    app.stage.addChild(highlightLayer);
    app.stage.sortableChildren = true;
    highlightLayerRef.current = highlightLayer;

    // 6) Add a simple title plate
    const title = new PIXI.Text("Mini Slot", {
      fontSize: 24,
      fill: 0xffffff,
      fontWeight: "bold",
    });
    title.anchor.set(0.5);
    title.x = APP_W / 2;
    title.y = 36;
    app.stage.addChild(title);
  };

  // ----- Start reel animation -----
  function spinReels() {
    if (!reelsRef.current.length) return;

    // Play the spin sound
    sound.stop("win");
    sound.play("spin", { volume: 0.7 });

    // For a "real slot" feel: each reel spins a bit longer than the previous.
    const baseDuration = 1.0; // seconds for one travel from top to bottom
    const repeats = 2;        // how many times the reel scrolls before the final stop

    reelsRef.current.forEach((reel, i) => {
      // We animate the reel container's Y from VIEWPORT.y down to VIEWPORT.y + (totalDistance)
      const totalDistance = SYMBOL_SIZE * ROWS * (repeats + 1); // scroll through 3 rows per repeat
      gsap.to(reel.container, {
        y: VIEWPORT.y + totalDistance,
        duration: baseDuration + i * 0.35, // staggered stop: later reels take longer
        ease: "power2.inOut",
        repeat: repeats,                    // do multiple cycles
        onRepeat: () => {
          // Optional: you can randomize symbols mid-spin for more variety
          // quickRandomize(reel);
        },
        onComplete: () => {
          // Reset back to the top
          reel.container.y = VIEWPORT.y;
          // Finalize the visible 3 symbols (this is what the player "stops" on)
          finalizeRandomSymbols(reel);

          // If this was the last reel to finish, notify React so it can score the spin.
          if (i === reelsRef.current.length - 1) {
            // Small delay so the eye can catch the final frame
            setTimeout(() => {
              sound.stop("spin");
              props.onSpinEnd && props.onSpinEnd();
            }, 100);
          }
        },
      });
    });
  }

  // Randomize all 3 sprites in a reel (called once at the end of the spin)
  function finalizeRandomSymbols(reel) {
    const { resources } = PIXI.Loader.shared;
    reel.sprites.forEach((sprite) => {
      const name = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      sprite.texture = resources[name].texture;
    });
  }

  // Optional: change textures during repeats to look more "shuffly"
  function quickRandomize(reel) {
    const { resources } = PIXI.Loader.shared;
    reel.sprites.forEach((sprite) => {
      const name = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
      sprite.texture = resources[name].texture;
    });
  }

  // ----- Read out the 3x3 visible grid for scoring -----
  // Result shape: [ [col0, col1, col2] for row0, row1, row2 ]
  function getResult() {
    if (!reelsRef.current.length) return null;

    // We know the reel is at rest with reel.container.y === VIEWPORT.y,
    // and sprites are positioned exactly at the 3 row centers in order.
    // So "sprites[0]" is the TOP row, etc.
    const rows = [[], [], []]; // top, middle, bottom
    reelsRef.current.forEach((reel) => {
      const topName = nameFromTexture(reel.sprites[0].texture);
      const midName = nameFromTexture(reel.sprites[1].texture);
      const botName = nameFromTexture(reel.sprites[2].texture);
      rows[0].push(topName);
      rows[1].push(midName);
      rows[2].push(botName);
    });
    return rows;
  }

  // Helper that tries to infer the original key (e.g., "cherry") from a texture
  function nameFromTexture(tex) {
    // Loader stores cache IDs; typically [ "cherry" ] because we added loader.add("cherry", ...).
    const ids = tex.textureCacheIds;
    return ids && ids.length ? ids[0] : "unknown";
  }

  // ----- Draw/clear glowing win lines -----
  function highlightPaylines(lines) {
    const layer = highlightLayerRef.current;
    if (!layer) return;

    // Clear old highlights
    layer.removeChildren();

    if (!lines || lines.length === 0) return;

    // Precompute Y centers for each row
    const rowCenter = (rowIdx) => VIEWPORT.y + rowIdx * SYMBOL_SIZE + SYMBOL_SIZE / 2;

    lines.forEach((line) => {
      const g = new PIXI.Graphics();
      // Base line style (gold)
      g.lineStyle(6, 0xffd700, 0.95);

      // Add a soft yellow glow
      g.filters = [new GlowFilter({ distance: 18, outerStrength: 3, color: 0xffff66 })];

      if (line.type === "row") {
        // Draw a horizontal line across all three reels at the row's center
        const y = rowCenter(line.row);
        g.moveTo(reelCentersX[0] - columnWidth / 2 + 10, y);
        g.lineTo(reelCentersX[2] + columnWidth / 2 - 10, y);
      } else if (line.type === "diag1") {
        // ↘ diagonal: top-left to bottom-right
        g.moveTo(reelCentersX[0] - columnWidth / 2 + 10, rowCenter(0));
        g.lineTo(reelCentersX[2] + columnWidth / 2 - 10, rowCenter(2));
      } else if (line.type === "diag2") {
        // ↙ diagonal: top-right to bottom-left
        g.moveTo(reelCentersX[2] + columnWidth / 2 - 10, rowCenter(0));
        g.lineTo(reelCentersX[0] - columnWidth / 2 + 10, rowCenter(2));
      }

      layer.addChild(g);

      // Make the line pulse a few times so it's noticeable
      gsap.fromTo(
        g,
        { alpha: 0.2 },
        { alpha: 1, duration: 0.35, repeat: 3, yoyo: true, ease: "sine.inOut" }
      );
    });

    // Play a win jingle
    sound.play("win", { volume: 0.9 });
  }

  return <div ref={rootRef} />;
});

export default GameCanvas;
