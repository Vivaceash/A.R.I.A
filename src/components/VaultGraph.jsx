import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Sliders,
  FileText,
  Tag,
  Link as LinkIcon,
  X,
  RefreshCw,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import './VaultGraph.css';

const VaultGraph = () => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);

  const [graphData, setGraphData] = useState({ nodes: [], links: [], categories: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [showLabels, setShowLabels] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [noteContent, setNoteContent] = useState(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // Physics params
  const [params, setParams] = useState({
    repulsion: 1800,
    springLength: 120,
    springStrength: 0.05,
    damping: 0.88,
    gravity: 0.03,
  });

  // State refs for animation loop
  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const isDraggingRef = useRef(false);
  const draggedNodeRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const hoveredNodeRef = useRef(null);
  const isSleepingRef = useRef(false);

  const wakeUp = useCallback(() => {
    isSleepingRef.current = false;
  }, []);

  // Fetch graph data from backend
  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      wakeUp();
      const res = await fetch('/api/vault/graph');
      const data = await res.json();
      setGraphData(data);

      const width = containerRef.current ? containerRef.current.clientWidth : 800;
      const height = containerRef.current ? containerRef.current.clientHeight : 600;

      // Initialize nodes with positions
      const existingPosMap = new Map();
      nodesRef.current.forEach(n => existingPosMap.set(n.id, { x: n.x, y: n.y, vx: n.vx, vy: n.vy }));

      const initializedNodes = data.nodes.map((node, i) => {
        const existing = existingPosMap.get(node.id);
        const angle = (i / (data.nodes.length || 1)) * 2 * Math.PI;
        const radius = Math.min(width, height) * 0.35 * Math.random() + 50;

        return {
          ...node,
          x: existing ? existing.x : width / 2 + Math.cos(angle) * radius,
          y: existing ? existing.y : height / 2 + Math.sin(angle) * radius,
          vx: existing ? existing.vx : (Math.random() - 0.5) * 2,
          vy: existing ? existing.vy : (Math.random() - 0.5) * 2,
          radius: Math.max(7, Math.min(18, 7 + (node.linksCount || 0) * 1.8)),
        };
      });

      nodesRef.current = initializedNodes;
      linksRef.current = data.links;
      setLoading(false);
    } catch (err) {
      console.error('Error fetching vault graph:', err);
      setLoading(false);
    }
  }, [wakeUp]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Load note details when a node is selected
  useEffect(() => {
    if (!selectedNode) {
      setNoteContent(null);
      return;
    }
    const fetchNote = async () => {
      setLoadingNote(true);
      try {
        const res = await fetch(`/api/vault/note?path=${encodeURIComponent(selectedNode.path)}`);
        if (res.ok) {
          const data = await res.json();
          setNoteContent(data);
        }
      } catch (err) {
        console.error('Error loading note:', err);
      } finally {
        setLoadingNote(false);
      }
    };
    fetchNote();
  }, [selectedNode]);

  // Physics simulation step with Kinetic Energy calculation
  const updatePhysics = useCallback(() => {
    const nodes = nodesRef.current;
    const links = linksRef.current;
    const { repulsion, springLength, springStrength, damping, gravity } = params;

    const width = containerRef.current ? containerRef.current.clientWidth : 800;
    const height = containerRef.current ? containerRef.current.clientHeight : 600;
    const cx = width / 2;
    const cy = height / 2;

    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));

    // 1. Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const dx = n2.x - n1.x;
        const dy = n2.y - n1.y;
        const distSq = dx * dx + dy * dy || 1;
        const dist = Math.sqrt(distSq);

        if (dist < 400) {
          const force = repulsion / distSq;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          n1.vx -= fx;
          n1.vy -= fy;
          n2.vx += fx;
          n2.vy += fy;
        }
      }

      // Gravitational pull toward center
      n1.vx += (cx - n1.x) * gravity;
      n1.vy += (cy - n1.y) * gravity;
    }

    // 2. Spring attraction along links
    links.forEach(l => {
      const source = nodeMap.get(l.source);
      const target = nodeMap.get(l.target);
      if (!source || !target) return;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - springLength;
      const force = displacement * springStrength;

      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });

    // 3. Update positions & track Kinetic Energy
    let totalKineticEnergy = 0;
    nodes.forEach(n => {
      if (draggedNodeRef.current === n) return; // Don't move actively dragged node

      n.vx *= damping;
      n.vy *= damping;

      n.x += n.vx;
      n.y += n.vy;

      totalKineticEnergy += n.vx * n.vx + n.vy * n.vy;
    });

    // Kinetic Sleep Threshold: pause physics loop when graph stabilizes
    if (totalKineticEnergy < 0.018 && !draggedNodeRef.current && !isDraggingRef.current) {
      isSleepingRef.current = true;
    }
  }, [params]);

  // Main Canvas render loop with Viewport Culling & HiDPI scaling
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const { x: panX, y: panY, scale } = transformRef.current;

    // Viewport Culling Bounding Box in World Coordinates
    const visibleLeft = -panX / scale - 80;
    const visibleTop = -panY / scale - 80;
    const visibleRight = (width / dpr - panX) / scale + 80;
    const visibleBottom = (height / dpr - panY) / scale + 80;

    // Clear background
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);

    const nodes = nodesRef.current;
    const links = linksRef.current;
    const nodeMap = new Map();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const hovered = hoveredNodeRef.current;
    const selected = selectedNode;
    const search = searchQuery.trim().toLowerCase();

    // Determine connected nodes if hovered or selected
    const activeFocus = hovered || selected;
    const connectedIds = new Set();
    if (activeFocus) {
      connectedIds.add(activeFocus.id);
      links.forEach(l => {
        if (l.source === activeFocus.id) connectedIds.add(l.target);
        if (l.target === activeFocus.id) connectedIds.add(l.source);
      });
    }

    // 1. Draw Links (Edges) with Viewport Culling
    links.forEach(l => {
      const source = nodeMap.get(l.source);
      const target = nodeMap.get(l.target);
      if (!source || !target) return;

      const isConnected = activeFocus && (
        (l.source === activeFocus.id && connectedIds.has(l.target)) ||
        (l.target === activeFocus.id && connectedIds.has(l.source))
      );

      // Skip lines outside visible screen unless connected to active node
      if (!isConnected && !activeFocus) {
        const srcIn = source.x >= visibleLeft && source.x <= visibleRight && source.y >= visibleTop && source.y <= visibleBottom;
        const tgtIn = target.x >= visibleLeft && target.x <= visibleRight && target.y >= visibleTop && target.y <= visibleBottom;
        if (!srcIn && !tgtIn) return;
      }

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      if (isConnected) {
        ctx.strokeStyle = '#60A5FA';
        ctx.lineWidth = 2.5 / scale;
        ctx.shadowColor = '#3B82F6';
        ctx.shadowBlur = 10;
      } else if (activeFocus) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1 / scale;
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1.2 / scale;
        ctx.shadowBlur = 0;
      }

      ctx.stroke();
      ctx.shadowBlur = 0;
    });

    // 2. Draw Nodes with Viewport Culling
    nodes.forEach(node => {
      // Category filter check
      const matchesCat = selectedCategory === 'ALL' || node.category === selectedCategory;
      const matchesSearch = !search || node.title.toLowerCase().includes(search) || (node.tags && node.tags.some(t => t.toLowerCase().includes(search)));

      const isHovered = hovered && hovered.id === node.id;
      const isSelected = selected && selected.id === node.id;
      const isConnected = activeFocus && connectedIds.has(node.id);
      const isDimmed = (activeFocus && !isConnected) || (!matchesCat && selectedCategory !== 'ALL') || (search && !matchesSearch);

      // Viewport culling: skip drawing offscreen non-focused nodes
      const inViewport = node.x >= visibleLeft && node.x <= visibleRight && node.y >= visibleTop && node.y <= visibleBottom;
      if (!inViewport && !isHovered && !isSelected && !isConnected) {
        return;
      }

      const radius = isHovered || isSelected ? node.radius * 1.35 : node.radius;

      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);

      if (isDimmed) {
        ctx.fillStyle = 'rgba(100, 116, 139, 0.2)';
        ctx.fill();
        ctx.restore();
        return;
      }

      // Outer glow for active nodes
      if (isHovered || isSelected) {
        ctx.shadowColor = node.color || '#8B5CF6';
        ctx.shadowBlur = 18;
      }

      // Node body
      ctx.fillStyle = node.color || '#3B82F6';
      ctx.fill();

      // Node border
      ctx.lineWidth = (isSelected ? 3 : 1.5) / scale;
      ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Labels (Level of Detail: skip distant labels on low zoom unless hovered/selected)
      const shouldDrawLabel = (showLabels || isHovered || isSelected || isConnected || (search && matchesSearch)) && scale >= 0.45;
      if (shouldDrawLabel) {
        const fontSize = Math.max(10, Math.min(13, 11 / Math.sqrt(scale)));
        ctx.font = `${isHovered || isSelected ? '600' : '400'} ${fontSize}px Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        const labelText = node.title.length > 24 ? node.title.substring(0, 22) + '…' : node.title;
        const textY = node.y + radius + 4;

        // Label background pill for readability
        const textWidth = ctx.measureText(labelText).width;
        ctx.fillStyle = 'rgba(10, 10, 10, 0.75)';
        ctx.beginPath();
        ctx.roundRect(node.x - textWidth / 2 - 4, textY - 2, textWidth + 8, fontSize + 4, 4);
        ctx.fill();

        ctx.fillStyle = isHovered || isSelected ? '#FFFFFF' : 'rgba(255, 255, 255, 0.85)';
        ctx.fillText(labelText, node.x, textY);
      }

      ctx.restore();
    });

    ctx.restore();
  }, [selectedCategory, searchQuery, showLabels, selectedNode]);

  // Adaptive Animation Frame Loop
  useEffect(() => {
    let isMounted = true;
    const loop = () => {
      if (!isMounted) return;
      if (!isSleepingRef.current) {
        updatePhysics();
      }
      render();
      animFrameRef.current = requestAnimationFrame(loop);
    };
    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [updatePhysics, render]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width = rect.width * dpr;
      canvasRef.current.height = rect.height * dpr;
      canvasRef.current.style.width = `${rect.width}px`;
      canvasRef.current.style.height = `${rect.height}px`;

      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mouse coordinate translation helper
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const { x: panX, y: panY, scale } = transformRef.current;

    return {
      x: (mouseX - panX) / scale,
      y: (mouseY - panY) / scale,
      screenX: mouseX,
      screenY: mouseY,
    };
  };

  // Find node under cursor
  const getNodeAt = (x, y) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= (node.radius + 6) * (node.radius + 6)) {
        return node;
      }
    }
    return null;
  };

  // Mouse & Touch Event Handlers
  const handleMouseDown = (e) => {
    wakeUp();
    const coords = getCanvasCoords(e);
    const clickedNode = getNodeAt(coords.x, coords.y);

    if (clickedNode) {
      draggedNodeRef.current = clickedNode;
      setSelectedNode(clickedNode);
    } else {
      isDraggingRef.current = true;
    }
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    const coords = getCanvasCoords(e);

    if (draggedNodeRef.current) {
      wakeUp();
      draggedNodeRef.current.x = coords.x;
      draggedNodeRef.current.y = coords.y;
      draggedNodeRef.current.vx = 0;
      draggedNodeRef.current.vy = 0;
    } else if (isDraggingRef.current) {
      wakeUp();
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      transformRef.current.x += dx;
      transformRef.current.y += dy;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    } else {
      const hovered = getNodeAt(coords.x, coords.y);
      if (hovered !== hoveredNodeRef.current) {
        hoveredNodeRef.current = hovered;
        wakeUp();
      }
      if (canvasRef.current) {
        canvasRef.current.style.cursor = hovered ? 'pointer' : 'grab';
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    draggedNodeRef.current = null;
    wakeUp();
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredNodeRef.current ? 'pointer' : 'grab';
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    wakeUp();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const currentScale = transformRef.current.scale;
    const newScale = Math.max(0.15, Math.min(3.5, currentScale * zoomFactor));

    // Zoom toward mouse position
    transformRef.current.x = mouseX - (mouseX - transformRef.current.x) * (newScale / currentScale);
    transformRef.current.y = mouseY - (mouseY - transformRef.current.y) * (newScale / currentScale);
    transformRef.current.scale = newScale;
  };

  // Zoom Button Controls
  const handleZoom = (factor) => {
    wakeUp();
    const width = containerRef.current ? containerRef.current.clientWidth : 800;
    const height = containerRef.current ? containerRef.current.clientHeight : 600;
    const cx = width / 2;
    const cy = height / 2;

    const currentScale = transformRef.current.scale;
    const newScale = Math.max(0.15, Math.min(3.5, currentScale * factor));

    transformRef.current.x = cx - (cx - transformRef.current.x) * (newScale / currentScale);
    transformRef.current.y = cy - (cy - transformRef.current.y) * (newScale / currentScale);
    transformRef.current.scale = newScale;
  };

  const handleResetView = () => {
    wakeUp();
    transformRef.current = { x: 0, y: 0, scale: 1 };
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(err => console.error(err));
      setIsFullscreen(false);
    }
  };

  return (
    <div className={`vault-graph-container ${isFullscreen ? 'fullscreen' : ''}`} ref={containerRef}>
      {/* Top Header / Stats bar */}
      <div className="graph-header-bar">
        <div className="graph-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar nota o tag en el grafo..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              wakeUp();
            }}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={() => { setSearchQuery(''); wakeUp(); }}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className="graph-category-filters">
          <button
            className={`cat-pill ${selectedCategory === 'ALL' ? 'active' : ''}`}
            onClick={() => { setSelectedCategory('ALL'); wakeUp(); }}
          >
            Todos ({graphData.total_nodes || 0})
          </button>
          {graphData.categories?.map(cat => (
            <button
              key={cat.name}
              className={`cat-pill ${selectedCategory === cat.name ? 'active' : ''}`}
              style={{ '--pill-color': cat.color }}
              onClick={() => { setSelectedCategory(selectedCategory === cat.name ? 'ALL' : cat.name); wakeUp(); }}
            >
              <span className="dot" style={{ backgroundColor: cat.color }}></span>
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>

        <div className="graph-action-buttons">
          <button
            className={`tool-btn ${showLabels ? 'active' : ''}`}
            title="Mostrar/ocultar etiquetas"
            onClick={() => { setShowLabels(!showLabels); wakeUp(); }}
          >
            Aa
          </button>
          <button
            className={`tool-btn ${showControls ? 'active' : ''}`}
            title="Ajustes de física"
            onClick={() => setShowControls(!showControls)}
          >
            <Sliders size={16} />
          </button>
          <button className="tool-btn" title="Recargar grafo" onClick={fetchGraph}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
          <button className="tool-btn" title="Pantalla completa" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        className="vault-graph-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      />

      {/* Floating Zoom / Reset Controls */}
      <div className="graph-floating-controls">
        <button onClick={() => handleZoom(1.2)} title="Acercar"><ZoomIn size={18} /></button>
        <button onClick={() => handleZoom(0.8)} title="Alejar"><ZoomOut size={18} /></button>
        <button onClick={handleResetView} title="Centrar vista"><RotateCcw size={18} /></button>
      </div>

      {/* Physics Settings Drawer */}
      {showControls && (
        <div className="graph-physics-panel">
          <div className="panel-header">
            <h4>Ajustes del Grafo</h4>
            <button onClick={() => setShowControls(false)}><X size={16} /></button>
          </div>
          <div className="panel-row">
            <label>Repulsión: {params.repulsion}</label>
            <input
              type="range"
              min="500"
              max="4000"
              step="100"
              value={params.repulsion}
              onChange={(e) => setParams(p => ({ ...p, repulsion: Number(e.target.value) }))}
            />
          </div>
          <div className="panel-row">
            <label>Distancia de enlaces: {params.springLength}px</label>
            <input
              type="range"
              min="40"
              max="250"
              step="10"
              value={params.springLength}
              onChange={(e) => setParams(p => ({ ...p, springLength: Number(e.target.value) }))}
            />
          </div>
          <div className="panel-row">
            <label>Gravedad al centro: {params.gravity}</label>
            <input
              type="range"
              min="0.005"
              max="0.1"
              step="0.005"
              value={params.gravity}
              onChange={(e) => setParams(p => ({ ...p, gravity: Number(e.target.value) }))}
            />
          </div>
        </div>
      )}

      {/* Note Inspector Card (Side Drawer) */}
      {selectedNode && (
        <div className="note-inspector-drawer">
          <div className="inspector-header">
            <div className="inspector-title-group">
              <span className="folder-badge" style={{ backgroundColor: selectedNode.color }}>
                {selectedNode.folder}
              </span>
              <h3>{selectedNode.title}</h3>
            </div>
            <button className="close-inspector-btn" onClick={() => setSelectedNode(null)}>
              <X size={18} />
            </button>
          </div>

          <div className="inspector-body">
            {/* Tags */}
            {selectedNode.tags && selectedNode.tags.length > 0 && (
              <div className="inspector-section">
                <div className="section-label"><Tag size={14} /> Tags</div>
                <div className="tag-badges">
                  {selectedNode.tags.map(t => (
                    <span key={t} className="tag-badge">#{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Outgoing Links */}
            {selectedNode.linked_notes && selectedNode.linked_notes.length > 0 && (
              <div className="inspector-section">
                <div className="section-label"><LinkIcon size={14} /> Enlaces salientes ({selectedNode.linked_notes.length})</div>
                <div className="link-chips">
                  {selectedNode.linked_notes.map(link => (
                    <button
                      key={link}
                      className="link-chip"
                      onClick={() => {
                        const targetNode = nodesRef.current.find(n => n.id.toLowerCase() === link.toLowerCase() || n.title.toLowerCase() === link.toLowerCase());
                        if (targetNode) setSelectedNode(targetNode);
                      }}
                    >
                      <ChevronRight size={12} />
                      {link}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Content Preview */}
            <div className="inspector-section content-section">
              <div className="section-label"><FileText size={14} /> Vista previa de nota</div>
              {loadingNote ? (
                <div className="note-loading">Cargando nota...</div>
              ) : noteContent ? (
                <div className="note-markdown-preview">
                  <pre>{noteContent.content}</pre>
                </div>
              ) : (
                <p className="note-preview-text">{selectedNode.preview || 'Sin vista previa.'}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VaultGraph;
