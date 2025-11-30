import React, { useEffect, useRef, useState, useCallback } from 'react';

// Constants
const LOGO_URL = 'https://raw.githubusercontent.com/Shervinuri/Shervinuri.github.io/refs/heads/main/1712259501956.png';
const MAX_PARTICLES = 7500;
const MOUSE_RADIUS = 150;
const PARTICLE_SIZE = 1.8;
const GAP = 2;

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  density: number;
  isScattered: boolean;
}

const BioGate: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  
  // Refs for animation loop state (mutable, no re-renders)
  const particlesRef = useRef<Particle[]>([]);
  const textPositionsRef = useRef<{x: number, y: number}[]>([]);
  const mouseRef = useRef<{ x: number | null, y: number | null }>({ x: null, y: null });
  const isPointerDownRef = useRef(false);
  const animationFrameId = useRef<number>(0);
  const hasInitializedRef = useRef(false); // Track if particles are successfully created
  
  // State for rendering UI changes
  const [isCircleMode, setIsCircleMode] = useState(false);
  const [isButtonVisible, setIsButtonVisible] = useState(false);
  const [isButtonClickable, setIsButtonClickable] = useState(false);
  
  // Helper refs for logic that shouldn't trigger re-renders but needs to be accessed in loops
  const modeStateRef = useRef({
    isCircleMode: false,
    isToggling: false
  });
  
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickabilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Particle Logic ---

  const createParticle = (x: number, y: number): Particle => ({
    x,
    y,
    baseX: x,
    baseY: y,
    size: PARTICLE_SIZE,
    density: (Math.random() * 30) + 10,
    isScattered: false
  });

  const initParticles = useCallback((width: number, height: number, ctx: CanvasRenderingContext2D) => {
    // Safety check to prevent IndexSizeError or zero-size canvas
    if (width <= 0 || height <= 0) return;

    // 1. Draw text to get data
    ctx.fillStyle = 'white';
    // Responsive font size
    const fontSize = Math.min(width * 0.2, 150);
    // Fallback to Arial if Josefin Sans isn't loaded yet to ensure *something* renders
    ctx.font = `600 ${fontSize}px "Josefin Sans", "Inter", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Clear before drawing to ensure clean slate
    ctx.clearRect(0, 0, width, height);
    
    // Draw Text
    ctx.fillText('SHΞЯVIN™', width / 2, height / 2);

    // Guard against reading if context is somehow invalid
    try {
        const textImageData = ctx.getImageData(0, 0, width, height);
        ctx.clearRect(0, 0, width, height); // Clear after reading

        // 2. Extract positions
        const potentialParticles: {x: number, y: number}[] = [];
        for (let y = 0; y < textImageData.height; y += GAP) {
          for (let x = 0; x < textImageData.width; x += GAP) {
            // Alpha channel > 128
            if (textImageData.data[(y * textImageData.width + x) * 4 + 3] > 128) {
              potentialParticles.push({ x, y });
            }
          }
        }

        // Only update particles if we actually found pixels. 
        // If 0 pixels found, font likely hasn't loaded or canvas is blank.
        if (potentialParticles.length > 0) {
            particlesRef.current = [];
            textPositionsRef.current = [];

            // Shuffle
            for (let i = potentialParticles.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [potentialParticles[i], potentialParticles[j]] = [potentialParticles[j], potentialParticles[i]];
            }

            const count = Math.min(MAX_PARTICLES, potentialParticles.length);
            for (let i = 0; i < count; i++) {
                const p = createParticle(potentialParticles[i].x, potentialParticles[i].y);
                particlesRef.current.push(p);
                textPositionsRef.current.push({ x: p.x, y: p.y });
            }
            
            // Mark as initialized so we stop forcing retries
            hasInitializedRef.current = true;
        }
    } catch (e) {
        console.error("Failed to init particles:", e);
    }
  }, []);

  const toggleMode = useCallback(() => {
    if (modeStateRef.current.isToggling) return;
    if (!isMountedRef.current) return;
    
    modeStateRef.current.isToggling = true;
    const newMode = !modeStateRef.current.isCircleMode;
    modeStateRef.current.isCircleMode = newMode;
    
    // Update React state for UI
    setIsCircleMode(newMode);

    // Reset Timers
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (clickabilityTimerRef.current) clearTimeout(clickabilityTimerRef.current);
    setIsButtonClickable(false);

    const canvas = canvasRef.current;
    if (!canvas) return;

    if (newMode) {
      // Switch to Circle
      setIsButtonVisible(true);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(canvas.width, canvas.height) * 0.35;

      particlesRef.current.forEach((p, i) => {
        const angle = (i / particlesRef.current.length) * Math.PI * 2;
        p.baseX = centerX + Math.cos(angle) * radius;
        p.baseY = centerY + Math.sin(angle) * radius;
      });

      clickabilityTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setIsButtonClickable(true);
      }, 600);

      // Auto revert
      inactivityTimerRef.current = setTimeout(() => {
         if (isMountedRef.current && modeStateRef.current.isCircleMode) toggleMode();
      }, 5000);

    } else {
      // Switch to Text
      setIsButtonVisible(false);
      particlesRef.current.forEach((p, i) => {
        if (textPositionsRef.current[i]) {
            p.baseX = textPositionsRef.current[i].x;
            p.baseY = textPositionsRef.current[i].y;
        }
      });
    }

    setTimeout(() => {
      modeStateRef.current.isToggling = false;
    }, 600);
  }, []);

  // --- Event Handlers ---

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    mouseRef.current.x = clientX;
    mouseRef.current.y = clientY;

    // Reset inactivity timer
    if (inactivityTimerRef.current && modeStateRef.current.isCircleMode) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        if (isMountedRef.current && modeStateRef.current.isCircleMode) toggleMode();
      }, 5000);
    }
  }, [toggleMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'w') toggleMode();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMode]);


  // --- Animation Loop ---

  useEffect(() => {
    isMountedRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let retryFrameCount = 0;

    const animate = () => {
      // Fade trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // --- GUARANTEE RENDER LOGIC ---
      // If particles are empty, it means initialization failed (black screen).
      // Retry every 10 frames (~160ms) until successful.
      if (particlesRef.current.length === 0) {
        retryFrameCount++;
        if (retryFrameCount > 10) {
            handleResize(); // Force retry
            retryFrameCount = 0;
        }
      }

      const isPointerDown = isPointerDownRef.current;
      const mouseX = mouseRef.current.x || 0;
      const mouseY = mouseRef.current.y || 0;

      for (let i = 0; i < particlesRef.current.length; i++) {
        const p = particlesRef.current[i];
        
        // Update
        if (isPointerDown) {
            const dx = mouseX - p.x;
            const dy = mouseY - p.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Avoid divide by zero
            if (distance < MOUSE_RADIUS && distance > 0.1) {
                p.isScattered = true;
                const force = (MOUSE_RADIUS - distance) / MOUSE_RADIUS;
                const strength = 0.5;
                p.x -= (dx / distance) * force * p.density * strength;
                p.y -= (dy / distance) * force * p.density * strength;
            } else {
                p.isScattered = false;
            }
        } else {
            p.isScattered = false;
        }

        // Return to base (easing)
        if (p.x !== p.baseX) p.x -= (p.x - p.baseX) / 12;
        if (p.y !== p.baseY) p.y -= (p.y - p.baseY) / 12;

        // Draw
        ctx.fillStyle = p.isScattered 
            ? 'rgba(255, 255, 255, 0.95)' 
            : 'rgba(255, 255, 255, 0.6)';
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    // Initialize Canvas Size and Particles
    const handleResize = () => {
        if (!canvas || !isMountedRef.current) return;
        
        // Ensure we always have valid dimensions
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        initParticles(canvas.width, canvas.height, ctx);
        
        // If resized while in circle mode, reset mode to text
        if (modeStateRef.current.isCircleMode) {
             toggleMode(); 
        }
    };

    // Initial Setup
    handleResize();
    
    // Start Loop
    animate();

    // Listeners
    window.addEventListener('resize', handleResize);
    
    // --- AGGRESSIVE INIT STRATEGY ---
    // Try to initialize multiple times to catch font loading or layout shifts
    const attempts = [100, 300, 500, 1000, 2000, 3000];
    const timers = attempts.map(delay => 
        setTimeout(() => {
            if (isMountedRef.current && !hasInitializedRef.current) {
                handleResize();
            }
        }, delay)
    );

    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (isMountedRef.current) handleResize();
        });
    }

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId.current);
      timers.forEach(t => clearTimeout(t));
    };
  }, [initParticles, toggleMode]);

  // --- Click Logic ---
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    clickCountRef.current += 1;
    if (clickCountRef.current === 1) {
        clickTimerRef.current = setTimeout(() => {
            clickCountRef.current = 0;
        }, 300);
    } else if (clickCountRef.current === 2) {
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
        clickCountRef.current = 0;
        toggleMode();
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full touch-none select-none"
      onMouseMove={handlePointerMove}
      onTouchMove={handlePointerMove}
      onMouseDown={() => { isPointerDownRef.current = true; }}
      onMouseUp={() => { isPointerDownRef.current = false; }}
      onMouseLeave={() => { isPointerDownRef.current = false; }}
      onTouchStart={() => { isPointerDownRef.current = true; }}
      onTouchEnd={() => { isPointerDownRef.current = false; }}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="block absolute top-0 left-0 w-full h-full z-[1]"
      />

      {/* Enter Button - Invisible Container, Logo Only */}
      <a
        href="https://t.me/shervini"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Enter Site"
        className={`
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-[160px] h-[160px] flex items-center justify-center z-10
            transition-all duration-500 ease-in-out
            ${isButtonVisible ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-75 invisible'}
            ${isButtonClickable ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
            hover:scale-110 [perspective:1000px]
        `}
        onClick={(e) => e.stopPropagation()} 
        onMouseDown={(e) => e.stopPropagation()}
      >
        <img 
            src={LOGO_URL} 
            alt="Logo" 
            className="w-full h-full object-contain animate-spin-y" 
        />
      </a>

      {/* Hint Text */}
      <p 
        className="absolute bottom-5 left-1/2 -translate-x-1/2 font-josefin text-sm tracking-[1.5px] z-[11] whitespace-nowrap bg-clip-text text-transparent animate-sweep pointer-events-none select-none"
        style={{
            background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.02))',
            backgroundSize: '250% 100%'
        }}
      >
        &gt; Dev tip: &gt; "dblclick" isn’t deprecated — it’s underrated ! 
      </p>
    </div>
  );
};

export default BioGate;