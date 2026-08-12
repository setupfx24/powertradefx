'use client';

/**
 * FallingText — vendored from the react-bits registry via
 *   npx shadcn@latest add @react-bits/FallingText-TS-TW
 *
 * Local changes on top of the upstream file, all required to ship here.
 * Re-running the registry command OVERWRITES this file and drops every
 * one of them, so re-apply if you update it.
 *
 *  1. 'use client'. The registry ships no directive, but this uses
 *     useState/useEffect; importing it from a Server Component (every
 *     page in this app is one) fails the build.
 *
 *  2. Words render as real JSX spans instead of being written with
 *     `textRef.current.innerHTML` in an effect. Upstream, nothing exists
 *     server-side, so the copy is absent from the HTML — fine for a demo,
 *     not for the marketing home's main statement, which needs to be in
 *     the markup for crawlers and for readers without JS. The physics
 *     still find the spans through querySelectorAll('span').
 *
 *  3. `highlightClass` + `className` props. Upstream hard-codes
 *     `text-cyan-500 font-bold` on highlighted words, which is not a
 *     colour in this palette.
 *
 *  4. prefers-reduced-motion is honoured: the simulation never starts,
 *     and because of change 2 the sentence is still fully rendered and
 *     readable. Upstream ignores the preference entirely.
 *
 *  5. Cleanup uses `render.canvas?.remove()` and a host node captured
 *     inside the effect. Upstream called `canvasContainerRef.current
 *     .removeChild(...)` at teardown, when React may already have
 *     detached it — the classic "Cannot read properties of null (reading
 *     'removeChild')" / NotFoundError pair.
 *
 *  6. The IntersectionObserver entry is optional-chained; this project
 *     runs noUncheckedIndexedAccess.
 *
 * Still upstream behaviour worth knowing: the update loop runs on an
 * unthrottled requestAnimationFrame that is never cancelled, so it keeps
 * ticking until the component unmounts.
 */

import { useRef, useState, useEffect, useMemo } from 'react';
import Matter from 'matter-js';

interface FallingTextProps {
  text?: string;
  highlightWords?: string[];
  /** Class applied to words matched by highlightWords. */
  highlightClass?: string;
  /** Class on the text layer — use it to set the face, weight and colour. */
  className?: string;
  trigger?: 'auto' | 'scroll' | 'click' | 'hover';
  backgroundColor?: string;
  wireframes?: boolean;
  gravity?: number;
  mouseConstraintStiffness?: number;
  fontSize?: string;
}

const FallingText: React.FC<FallingTextProps> = ({
  text = '',
  highlightWords = [],
  highlightClass = '',
  className = '',
  trigger = 'auto',
  backgroundColor = 'transparent',
  wireframes = false,
  gravity = 1,
  mouseConstraintStiffness = 0.2,
  fontSize = '1rem',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);

  const [effectStarted, setEffectStarted] = useState(false);

  /* Punctuation is stripped before matching so "market." still matches a
     highlight word of "market". */
  const words = useMemo(() => {
    const bare = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
    const needles = highlightWords.map(bare).filter(Boolean);
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => ({ word, highlighted: needles.includes(bare(word)) }));
  }, [text, highlightWords]);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    if (trigger === 'auto') {
      setEffectStarted(true);
      return;
    }
    if (trigger === 'scroll' && containerRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            setEffectStarted(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 },
      );
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [trigger]);

  useEffect(() => {
    if (!effectStarted) return;

    const { Engine, Render, World, Bodies, Runner, Mouse, MouseConstraint } = Matter;

    if (!containerRef.current || !canvasContainerRef.current || !textRef.current) return;

    /* Captured now rather than read again at teardown, when React may
       already have detached the node. */
    const canvasHost = canvasContainerRef.current;

    const containerRect = containerRef.current.getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    if (width <= 0 || height <= 0) return;

    const engine = Engine.create();
    engine.world.gravity.y = gravity;

    const render = Render.create({
      element: canvasHost,
      engine,
      options: { width, height, background: backgroundColor, wireframes },
    });

    const boundaryOptions = { isStatic: true, render: { fillStyle: 'transparent' } };
    const floor = Bodies.rectangle(width / 2, height + 25, width, 50, boundaryOptions);
    const leftWall = Bodies.rectangle(-25, height / 2, 50, height, boundaryOptions);
    const rightWall = Bodies.rectangle(width + 25, height / 2, 50, height, boundaryOptions);
    const ceiling = Bodies.rectangle(width / 2, -25, width, 50, boundaryOptions);

    const wordSpans = textRef.current.querySelectorAll('span');
    const wordBodies = [...wordSpans].map((elem) => {
      const rect = elem.getBoundingClientRect();
      const x = rect.left - containerRect.left + rect.width / 2;
      const y = rect.top - containerRect.top + rect.height / 2;

      const body = Bodies.rectangle(x, y, rect.width, rect.height, {
        render: { fillStyle: 'transparent' },
        restitution: 0.8,
        frictionAir: 0.01,
        friction: 0.2,
      });
      Matter.Body.setVelocity(body, { x: (Math.random() - 0.5) * 5, y: 0 });
      Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);

      return { elem: elem as HTMLElement, body };
    });

    wordBodies.forEach(({ elem, body }) => {
      elem.style.position = 'absolute';
      elem.style.left = `${body.position.x - body.bounds.max.x + body.bounds.min.x / 2}px`;
      elem.style.top = `${body.position.y - body.bounds.max.y + body.bounds.min.y / 2}px`;
      elem.style.transform = 'none';
    });

    const mouse = Mouse.create(containerRef.current);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: mouseConstraintStiffness, render: { visible: false } },
    });
    render.mouse = mouse;

    World.add(engine.world, [
      floor,
      leftWall,
      rightWall,
      ceiling,
      mouseConstraint,
      ...wordBodies.map((wb) => wb.body),
    ]);

    const runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);

    /* Upstream never cancelled this. Tracked so teardown can stop it
       instead of leaving a rAF loop running against a dead engine. */
    let frame = 0;
    const updateLoop = () => {
      wordBodies.forEach(({ body, elem }) => {
        const { x, y } = body.position;
        elem.style.left = `${x}px`;
        elem.style.top = `${y}px`;
        elem.style.transform = `translate(-50%, -50%) rotate(${body.angle}rad)`;
      });
      Matter.Engine.update(engine);
      frame = requestAnimationFrame(updateLoop);
    };
    updateLoop();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      Render.stop(render);
      Runner.stop(runner);
      /* .remove() detaches from whatever parent the canvas actually has and
         is a no-op if it has none, unlike removeChild. */
      render.canvas?.remove();
      World.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [effectStarted, gravity, wireframes, backgroundColor, mouseConstraintStiffness]);

  const handleTrigger = () => {
    if (!effectStarted && (trigger === 'click' || trigger === 'hover')) {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      setEffectStarted(true);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative z-[1] w-full h-full overflow-hidden"
      onClick={trigger === 'click' ? handleTrigger : undefined}
      onMouseEnter={trigger === 'hover' ? handleTrigger : undefined}
    >
      <div
        ref={textRef}
        className={className}
        style={{ fontSize, lineHeight: 1.4 }}
      >
        {words.map(({ word, highlighted }, i) => (
          <span
            // Words repeat, so the index is part of the identity.
            key={`${word}-${i}`}
            className={`inline-block mx-[0.14em] select-none ${highlighted ? highlightClass : ''}`}
          >
            {word}
          </span>
        ))}
      </div>

      <div className="absolute top-0 left-0 z-0" ref={canvasContainerRef} />
    </div>
  );
};

export default FallingText;
