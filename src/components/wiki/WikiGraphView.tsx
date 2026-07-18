import { useEffect, useRef, useCallback, useState } from 'react';
import { getWikiLinkGraph } from '../../lib/wikiData';
import type { WikiGraphNode, WikiGraphEdge } from '../../types/wiki';

const WIDTH = 800;
const HEIGHT = 600;
const NODE_RADIUS = 12; // doubled from 6 to make nodes 1x bigger
const REPULSION = 380; // increased from 140 to spread nodes apart
const SPRING_LENGTH = 130; // increased from 60 to expand distances
const SPRING_STRENGTH = 0.025; // softer spring force so they can relax
const DAMPING = 0.85;
const CENTER_FORCE = 0.008; // weaker centering force to let nodes spread out

interface GraphNode extends WikiGraphNode {
  type?: 'page' | 'heading';
}

function buildGraph() {
  const { nodes: infoNodes, edges } = getWikiLinkGraph();
  const nodeMap = new Map<string, GraphNode>();

  for (const info of infoNodes) {
    const isPage = info.type === 'page';
    nodeMap.set(info.id, {
      id: info.id,
      title: info.title,
      type: info.type,
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      vx: 0,
      vy: 0,
      radius: isPage ? NODE_RADIUS + 4 : NODE_RADIUS - 3, // Page = 16px, Heading = 9px
    });
  }

  const typedEdges: WikiGraphEdge[] = edges
    .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map((e) => ({ source: e.source, target: e.target }));

  return { nodes: Array.from(nodeMap.values()), edges: typedEdges };
}

interface WikiGraphViewProps {
  onNavigate: (title: string) => void;
}

export default function WikiGraphView({ onNavigate }: WikiGraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredNodeText, setHoveredNodeText] = useState<string | null>(null);
  const hoveredNodeRef = useRef<string | null>(null);
  const simRef = useRef<{ nodes: GraphNode[]; edges: WikiGraphEdge[] } | null>(null);
  const rafRef = useRef<number>(0);
  const draggingRef = useRef<string | null>(null);
  const alphaRef = useRef<number>(1.0); // Physics simulation heat / temperature

  const initSim = useCallback(() => {
    const { nodes, edges } = buildGraph();
    simRef.current = { nodes, edges };
    alphaRef.current = 1.0; // Reset energy
  }, []);

  useEffect(() => {
    initSim();
    return () => cancelAnimationFrame(rafRef.current);
  }, [initSim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rawCtx = canvas.getContext('2d');
    if (!rawCtx) return;

    const ctx = rawCtx;

    function step() {
      const sim = simRef.current;
      if (!sim) return;
      const { nodes, edges } = sim;
      const hovered = hoveredNodeRef.current;

      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Reset scale on every frame to prevent React render cycles from wiping out the scale

      // Only compute forces if the simulation is still hot
      if (alphaRef.current > 0.005) {
        const alpha = alphaRef.current;

        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const a = nodes[i];
            const b = nodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            // Cap minimum distance to avoid division spike/explosion
            const capDist = Math.max(dist, 25);
            const force = (REPULSION / (capDist * capDist)) * alpha;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx -= fx;
            a.vy -= fy;
            b.vx += fx;
            b.vy += fy;
          }
        }

        // Spring attraction
        for (const edge of edges) {
          const a = nodes.find((n) => n.id === edge.source);
          const b = nodes.find((n) => n.id === edge.target);
          if (!a || !b) continue;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }

        // Physics damping & velocity clamping
        const cx = WIDTH / 2;
        const cy = HEIGHT / 2;
        const maxSpeed = 3.5;

        for (const node of nodes) {
          node.vx *= DAMPING;
          node.vy *= DAMPING;

          // Clamp speed to avoid physics oscillations
          const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
          if (speed > maxSpeed) {
            node.vx = (node.vx / speed) * maxSpeed;
            node.vy = (node.vy / speed) * maxSpeed;
          }

          if (draggingRef.current !== node.id) {
            node.x += node.vx;
            node.y += node.vy;
          }
        }

        // --- Fit-to-Viewport Centering & Zoom Algorithm ---
        if (nodes.length > 1) {
          // 1. Calculate the current bounding box of the graph
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          for (const node of nodes) {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
          }

          const graphW = maxX - minX || 1;
          const graphH = maxY - minY || 1;
          const currentCx = (minX + maxX) / 2;
          const currentCy = (minY + maxY) / 2;

          // 2. Translate all nodes to center the graph cluster in the canvas (cx, cy)
          const dx = cx - currentCx;
          const dy = cy - currentCy;
          for (const node of nodes) {
            if (draggingRef.current !== node.id) {
              node.x += dx;
              node.y += dy;
            }
          }

          // 3. Scale node positions relative to the center to fill 80% (0.2 margin total) of canvas space
          const targetW = WIDTH * 0.8;
          const targetH = HEIGHT * 0.8;
          const idealScale = Math.min(targetW / graphW, targetH / graphH);
          
          // Smoothen zoom scale interpolation
          const scaleFactor = 1 + (idealScale - 1) * 0.1;
          for (const node of nodes) {
            if (draggingRef.current !== node.id) {
              node.x = cx + (node.x - cx) * scaleFactor;
              node.y = cy + (node.y - cy) * scaleFactor;
            }
          }
        }

        // Cool down layout over time
        alphaRef.current *= 0.985;
      }

      // Draw
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // Edges
      ctx.strokeStyle = 'rgba(150,150,150,0.12)';
      ctx.lineWidth = 0.75;
      for (const edge of edges) {
        const a = nodes.find((n) => n.id === edge.source);
        const b = nodes.find((n) => n.id === edge.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // Nodes
      for (const node of nodes) {
        const isHovered = hovered === node.id;
        const isDragging = draggingRef.current === node.id;
        const isPage = node.type === 'page';

        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered || isDragging ? node.radius + 3 : node.radius, 0, Math.PI * 2);

        if (isPage) {
          ctx.fillStyle = isHovered || isDragging ? '#3b82f6' : '#60a5fa'; // Blue accent for pages
        } else {
          ctx.fillStyle = isHovered || isDragging ? '#10b981' : '#9ca3af'; // Emerald for hovered heading, gray for others
        }
        ctx.fill();

        // Outlines for main page nodes
        if (isPage) {
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Label rendering (pages show labels periodically or if hovered, headings only if hovered)
        const showLabel = isHovered || (isPage && nodes.indexOf(node) % 3 === 0);
        if (showLabel) {
          const isDark = document.documentElement.classList.contains('dark');
          ctx.fillStyle = isDark ? '#ffffff' : '#1f2937';
          ctx.font = isPage
            ? (isHovered ? 'bold 11px sans-serif' : '10px sans-serif')
            : '9px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(node.title.slice(0, 20), node.x, node.y + node.radius + 12);
        }
      }
    }

    const loop = () => {
      step();
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // Run loop once on mount, reads state via refs

  const getNodeAt = (x: number, y: number) => {
    const sim = simRef.current;
    if (!sim) return null;
    for (const node of sim.nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (Math.sqrt(dx * dx + dy * dy) < node.radius + 8) return node.id;
    }
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = WIDTH / (rect.width || 1);
    const scaleY = HEIGHT / (rect.height || 1);
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (draggingRef.current && simRef.current) {
      alphaRef.current = 1.0; // Re-heat simulation on drag
      const node = simRef.current.nodes.find((n) => n.id === draggingRef.current);
      if (node) {
        node.x = x;
        node.y = y;
        node.vx = 0;
        node.vy = 0;
      }
    }

    const nodeId = getNodeAt(x, y);
    hoveredNodeRef.current = nodeId;
    setHoveredNodeText(nodeId);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = WIDTH / (rect.width || 1);
    const scaleY = HEIGHT / (rect.height || 1);
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const nodeId = getNodeAt(x, y);
    if (nodeId) {
      draggingRef.current = nodeId;
      alphaRef.current = 1.0; // Re-heat simulation on click/grab
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = null;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = WIDTH / (rect.width || 1);
    const scaleY = HEIGHT / (rect.height || 1);
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const nodeId = getNodeAt(x, y);

    if (nodeId) {
      if (nodeId.includes('#')) {
        const [pageTitle, headingText] = nodeId.split('#');
        onNavigate(pageTitle);
        // Scroll to the heading after a small timeout to let the page mount
        setTimeout(() => {
          const slug = headingText
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
          const el = document.getElementById(slug);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      } else {
        onNavigate(nodeId);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className="text-sm text-muted-foreground min-h-[20px]">
        {hoveredNodeText ? (
          <span>
            Click <strong>{hoveredNodeText.includes('#') ? hoveredNodeText.split('#')[1] : hoveredNodeText}</strong> to open
          </span>
        ) : (
          'Drag nodes to rearrange · Click a node to navigate'
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={WIDTH * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)}
        height={HEIGHT * (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)}
        className="rounded-xl border border-border bg-card cursor-grab active:cursor-grabbing w-full max-w-[800px] aspect-[4/3] h-auto"
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleClick}
      />
    </div>
  );
}
