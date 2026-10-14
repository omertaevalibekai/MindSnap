import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import dagre from "dagre";

type Layout = "radial" | "horizontal" | "vertical";
type LabelMode = "compact" | "all";

export interface CanvasMindNode {
  id: string;
  __path: string;
  label?: string;
  summary?: string;
  theses?: string[];
  importance?: "high" | "medium" | "low";
  nodeType?: string;
  children: CanvasMindNode[];
}

interface MindMapCanvasProps {
  data: unknown;
  onBranchNotes?: (notes: string) => void;
  onNodeSelect?: (node: CanvasMindNode | null) => void;
}

interface Snapshot {
  collapsedIds: string[];
  focusNodeId: string | null;
  selectedNodeId: string | null;
}

interface Point {
  x: number;
  y: number;
}

interface NodePreviewState {
  nodeId: string;
  label: string;
  summary: string;
  theses: string[];
}

export const MindMapCanvas = ({ data, onBranchNotes, onNodeSelect }: MindMapCanvasProps) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [layout, setLayout] = useState<Layout>("horizontal");
  const [labelMode, setLabelMode] = useState<LabelMode>("compact");
  const [activeText, setActiveText] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [nodePreview, setNodePreview] = useState<NodePreviewState | null>(null);
  const [expandedListNodeId, setExpandedListNodeId] = useState<string | null>(null);
  const [past, setPast] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);

  const rootData = useMemo(() => (data as { root?: { label?: string; children?: unknown[] } })?.root, [data]);
  const mappedRoot = useMemo(() => withPathIds(rootData, "root"), [rootData]);
  const focusedRoot = useMemo(() => (focusNodeId ? findById(mappedRoot, focusNodeId) ?? mappedRoot : mappedRoot), [mappedRoot, focusNodeId]);
  const visibleRoot = useMemo(() => applyCollapsed(focusedRoot, collapsedIds), [focusedRoot, collapsedIds]);
  const selectedNode = useMemo(() => (selectedNodeId ? findById(mappedRoot, selectedNodeId) : null), [mappedRoot, selectedNodeId]);
  const expandedListNode = useMemo(() => (expandedListNodeId ? findById(mappedRoot, expandedListNodeId) : null), [mappedRoot, expandedListNodeId]);
  const childrenCountById = useMemo(() => buildChildrenCountMap(mappedRoot), [mappedRoot]);
  const canvasHeight = useMemo(() => {
    const leaves = countLeaves(visibleRoot);
    if (layout === "horizontal") {
      const byLeaves = leaves * 34 + 100;
      return Math.max(360, Math.min(700, byLeaves));
    }
    if (layout === "vertical") {
      const byLeaves = leaves * 54 + 180;
      return Math.max(520, Math.min(1100, byLeaves));
    }
    const byLeaves = leaves * 46 + 180;
    return Math.max(500, Math.min(980, byLeaves));
  }, [visibleRoot, layout]);

  const snapshot = (): Snapshot => ({
    collapsedIds: [...collapsedIds],
    focusNodeId,
    selectedNodeId
  });

  const commit = (updater: () => void): void => {
    setPast((prev) => [...prev, snapshot()]);
    setFuture([]);
    updater();
  };

  const undo = (): void => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setFuture((f) => [snapshot(), ...f]);
      setCollapsedIds(new Set(last.collapsedIds));
      setFocusNodeId(last.focusNodeId);
      setSelectedNodeId(last.selectedNodeId);
      return prev.slice(0, -1);
    });
  };

  const redo = (): void => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const next = prev[0];
      setPast((p) => [...p, snapshot()]);
      setCollapsedIds(new Set(next.collapsedIds));
      setFocusNodeId(next.focusNodeId);
      setSelectedNodeId(next.selectedNodeId);
      return prev.slice(1);
    });
  };

  useEffect(() => {
    onNodeSelect?.(selectedNode);
  }, [selectedNode, onNodeSelect]);

  const zoomToFit = (animate = true): void => {
    if (!svgRef.current || !viewportRef.current || !zoomRef.current) return;
    const svgNode = svgRef.current;
    const bbox = viewportRef.current.node()?.getBBox();
    if (!bbox || bbox.width <= 0 || bbox.height <= 0) return;

    const width = svgNode.clientWidth || 360;
    const height = Number(svgNode.getAttribute("height") ?? "420");
    const padding = 24;
    const scale = Math.max(0.35, Math.min(2.6, Math.min((width - padding * 2) / bbox.width, (height - padding * 2) / bbox.height)));
    const tx = width / 2 - (bbox.x + bbox.width / 2) * scale;
    const ty = height / 2 - (bbox.y + bbox.height / 2) * scale;
    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);

    const svg = d3.select(svgNode);
    const call = animate ? svg.transition().duration(260) : svg;
    call.call(zoomRef.current.transform, transform);
  };

  useEffect(() => {
    if (!svgRef.current || !visibleRoot) return;

    const svgNode = svgRef.current;
    const svg = d3.select(svgNode);
    svg.selectAll("*").remove();

    const width = svgNode.clientWidth || 360;
    const height = canvasHeight;

    const viewport = svg.append("g").attr("class", "viewport");
    viewportRef.current = viewport;

    const root = d3.hierarchy<CanvasMindNode>(visibleRoot);

    if (layout === "radial") {
      const descendantsCount = root.descendants().length;
      const radius = Math.max(220, Math.min(420, 190 + descendantsCount * 3));
      d3.tree<CanvasMindNode>().size([360, radius]).separation((a, b) => (a.parent === b.parent ? 1.7 : 2.4))(root);
    } else {
      const verticalGap = layout === "horizontal" ? 62 : 128;
      const horizontalGap = layout === "horizontal" ? 185 : 210;
      d3.tree<CanvasMindNode>()
        .nodeSize([verticalGap, horizontalGap])
        .separation((a, b) => {
          const siblingGap = layout === "horizontal" ? (a.parent === b.parent ? 1.55 : 2.25) : a.parent === b.parent ? 2.3 : 3.4;
          const leafBoost = (!a.children || a.children.length === 0) && (!b.children || b.children.length === 0) ? (layout === "horizontal" ? 0.35 : 0.7) : 0;
          return siblingGap + leafBoost;
        })(root);
    }

    const descendants = root.descendants();
    const links = root.links();
    const cardWidthById = new Map<string, number>();
    descendants.forEach((node) => {
      cardWidthById.set(node.data.id, nodeCardWidth(node.data.label ?? ""));
    });

    const positions =
      layout === "horizontal"
        ? buildHorizontalDagreLayout(root, links, cardWidthById)
        : new Map<string, Point>(descendants.map((node) => [node.data.id, projectNode(node, layout)]));
    if (layout === "vertical") {
      applyVerticalAntiCollision(root, positions);
    }

    const getPoint = (node: d3.HierarchyNode<CanvasMindNode>): Point => positions.get(node.data.id) ?? projectNode(node, layout);

    const linkPath = (link: d3.HierarchyLink<CanvasMindNode>): string => {
      const s = getPoint(link.source);
      const t = getPoint(link.target);
      if (layout === "radial") {
        return `M${s.x} ${s.y} C ${s.x + (t.x - s.x) * 0.45} ${s.y + (t.y - s.y) * 0.1} ${s.x + (t.x - s.x) * 0.55} ${s.y + (t.y - s.y) * 0.9} ${t.x} ${t.y}`;
      }
      if (layout === "vertical") {
        const sy = s.y + 15;
        const ty = t.y - 15;
        return `M${s.x} ${sy} C ${s.x} ${sy + (ty - sy) * 0.35} ${t.x} ${sy + (ty - sy) * 0.65} ${t.x} ${ty}`;
      }
      const sourceWidth = cardWidthById.get(link.source.data.id) ?? 140;
      const targetWidth = cardWidthById.get(link.target.data.id) ?? 140;
      const sx = s.x + sourceWidth / 2;
      const tx = t.x - targetWidth / 2;
      return `M${sx} ${s.y} C ${sx + (tx - sx) * 0.35} ${s.y} ${sx + (tx - sx) * 0.65} ${t.y} ${tx} ${t.y}`;
    };

    const linksSel = viewport
      .selectAll("path.link")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#c2cbdb")
      .attr("stroke-width", 1.1)
      .attr("opacity", 0)
      .attr("d", linkPath);

    linksSel.transition().duration(260).attr("opacity", 1);

    const nodeGroups = viewport
      .selectAll<SVGGElement, d3.HierarchyNode<CanvasMindNode>>("g.node")
      .data(descendants, (node) => node.data.id)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("opacity", 0)
      .attr("transform", (node) => {
        const p = getPoint(node);
        return `translate(${p.x},${p.y})`;
      })
      .style("cursor", "pointer");

    nodeGroups
      .append("rect")
      .attr("x", (node) => -(cardWidthById.get(node.data.id) ?? 140) / 2)
      .attr("y", -15)
      .attr("width", (node) => cardWidthById.get(node.data.id) ?? 140)
      .attr("height", 30)
      .attr("rx", 8)
      .attr("fill", (node) => ((node.data?.importance ?? "medium") === "high" ? "#e9eeff" : "#f7f9ff"))
      .attr("stroke", (node) => (selectedNodeId && node.data.id === selectedNodeId ? "#6366f1" : "#c5d0e2"))
      .attr("stroke-width", (node) => (selectedNodeId && node.data.id === selectedNodeId ? 1.8 : 1));

    nodeGroups
      .append("text")
      .attr("font-size", 10.5)
      .attr("fill", "#1e293b")
      .attr("text-anchor", "middle")
      .attr("x", 0)
      .attr("y", 3.5)
      .text((node) => truncateLabel(String(node.data?.label ?? ""), labelMode === "all" ? 36 : 24));

    nodeGroups
      .filter((node) => (childrenCountById[node.data.id] ?? 0) > 0)
      .append("text")
      .attr("font-size", 10)
      .attr("fill", "#64748b")
      .attr("text-anchor", "middle")
      .attr("x", (node) => (cardWidthById.get(node.data.id) ?? 140) / 2 - 10)
      .attr("y", 3)
      .text((node) => (collapsedIds.has(node.data.id) ? "▸" : "▾"));

    nodeGroups
      .filter((node) => (childrenCountById[node.data.id] ?? 0) > 0)
      .append("text")
      .attr("font-size", 11)
      .attr("fill", "#475569")
      .attr("text-anchor", "middle")
      .attr("x", (node) => (cardWidthById.get(node.data.id) ?? 140) / 2 - 22)
      .attr("y", 3)
      .style("cursor", "pointer")
      .text(">")
      .on("click", (event, node) => {
        event.stopPropagation();
        setExpandedListNodeId((prev) => (prev === node.data.id ? null : node.data.id));
        setSelectedNodeId(node.data.id);
      });

    nodeGroups.transition().duration(260).attr("opacity", 1);

    const selectNode = (node: CanvasMindNode): void => {
      const primaryThesis = node.theses?.[0]?.trim();
      setActiveText(primaryThesis || node.summary || node.label || "");
      setSelectedNodeId(node.id);
      setNodePreview({
        nodeId: node.id,
        label: node.label ?? "Node",
        summary: node.summary ?? "",
        theses: Array.isArray(node.theses) ? node.theses.slice(0, 3) : []
      });
    };

    const toggleCollapsedNode = (id: string): void => {
      commit(() => {
        setCollapsedIds((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      });
    };

    nodeGroups
      .on("click", (_, node) => selectNode(node.data))
      .on("dblclick", (_, node) => toggleCollapsedNode(node.data.id));

    const drag = d3
      .drag<SVGGElement, d3.HierarchyNode<CanvasMindNode>>()
      .on("drag", function (event, node) {
        const next = positions.get(node.data.id);
        if (!next) return;
        next.x += event.dx;
        next.y += event.dy;
        positions.set(node.data.id, next);

        d3.select(this).attr("transform", `translate(${next.x},${next.y})`);
        linksSel.attr("d", linkPath);
      });

    nodeGroups.call(drag);

    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.3, 3.5]).on("zoom", (event) => {
      viewport.attr("transform", event.transform.toString());
    });
    zoomRef.current = zoom;
    svg.call(zoom);

    zoomToFit(false);
  }, [layout, visibleRoot, labelMode, selectedNodeId, collapsedIds, childrenCountById, canvasHeight]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const targetTag = (event.target as HTMLElement | null)?.tagName;
      const isTyping = targetTag === "INPUT" || targetTag === "TEXTAREA";
      if (!isTyping && event.key === " " && selectedNodeId) {
        event.preventDefault();
        commit(() => {
          setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(selectedNodeId)) next.delete(selectedNodeId);
            else next.add(selectedNodeId);
            return next;
          });
        });
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNodeId, past, future]);

  return (
    <section className="panel-card space-y-2 bg-slate-900">
      <div className="flex flex-wrap gap-2 text-xs">
        <button onClick={() => setLabelMode((prev) => (prev === "compact" ? "all" : "compact"))} className="rounded border border-slate-600 px-2 py-1">
          Labels: {labelMode}
        </button>
      </div>

      {focusNodeId ? <div className="rounded border border-indigo-400/40 bg-indigo-500/10 px-2 py-1 text-xs text-indigo-200">Focus mode active</div> : null}

      <div className="relative">
        <svg ref={svgRef} width="100%" height={canvasHeight} className="rounded border border-slate-700 bg-slate-950" />
        {nodePreview ? (
          <div className="pointer-events-none absolute left-2 top-2 max-w-72 rounded border border-slate-700 bg-slate-900/95 p-2 text-xs">
            <div className="font-semibold text-slate-100">{nodePreview.label}</div>
            <div className="mt-1 text-slate-300">{nodePreview.summary || "No summary available."}</div>
            {nodePreview.theses.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-4 text-slate-200">
                {nodePreview.theses.map((thesis, index) => (
                  <li key={`${nodePreview.nodeId}-${index}`} className="font-semibold">{thesis}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="text-xs text-slate-300">{activeText || "Click card to preview thesis. Double-click card to collapse/expand branch. Drag cards to rearrange."}</p>
      {expandedListNode && expandedListNode.children.length > 0 ? (
        <section className="rounded border border-slate-700 bg-slate-900 p-2 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold text-slate-100">
              {expandedListNode.label}: subtopics
            </div>
            <button
              className="rounded border border-slate-600 px-2 py-1 text-[11px]"
              onClick={() => setExpandedListNodeId(null)}
            >
              Close
            </button>
          </div>
          <div className="space-y-2">
            {expandedListNode.children.map((child) => (
              <div
                key={`${expandedListNode.id}-${child.id}`}
                className="rounded border border-slate-700 bg-slate-950/70 px-2 py-2"
              >
                <div className="text-slate-200">
                  {expandedListNode.label} {"->"} {child.label}
                </div>
                <div className="mt-1 text-slate-400">{child.summary || "No summary."}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

    </section>
  );
};

const projectNode = (node: d3.HierarchyNode<CanvasMindNode>, layout: Layout): Point => {
  if (layout === "radial") {
    return { x: polarX(node.x, node.y), y: polarY(node.x, node.y) };
  }
  if (layout === "horizontal") {
    return { x: safe(node.y), y: safe(node.x) };
  }
  return { x: safe(node.x), y: safe(node.y) };
};

const buildBranchNotes = (node: CanvasMindNode): string => {
  const lines = [`## ${node.label ?? "Selected branch"}`, "", ...branchLines(node, 0)];
  return lines.join("\n");
};

const branchLines = (node: CanvasMindNode, depth: number): string[] => {
  const indent = "  ".repeat(depth);
  const line = `${indent}- ${node.label ?? "Node"}: ${node.summary ?? ""}`.trimEnd();
  return [line, ...node.children.flatMap((child) => branchLines(child, depth + 1))];
};

const truncateLabel = (value: string, max = 24): string => (value.length <= max ? value : `${value.slice(0, max - 2)}..`);

const nodeCardWidth = (label: string): number => {
  const size = Math.max(120, Math.min(230, normalizeLabelLen(label) * 6.8 + 34));
  return Number.isFinite(size) ? size : 140;
};

const normalizeLabelLen = (value: string): number => value.trim().length || 8;

const nodeTypeColor = (nodeType?: string): string => {
  if (nodeType === "fact") return "#22c55e";
  if (nodeType === "example") return "#a855f7";
  if (nodeType === "warning") return "#f97316";
  if (nodeType === "question") return "#facc15";
  if (nodeType === "action") return "#ef4444";
  return "#3b82f6";
};

const collectBranchIds = (node: CanvasMindNode | undefined): string[] => {
  if (!node) return [];
  const branch = node.children.length > 0 ? [node.id] : [];
  return [...branch, ...node.children.flatMap((child) => collectBranchIds(child))];
};

const findById = (node: CanvasMindNode | undefined, id: string): CanvasMindNode | null => {
  if (!node) return null;
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
};

const applyCollapsed = (node: CanvasMindNode | null | undefined, collapsed: Set<string>): CanvasMindNode | undefined => {
  if (!node) return undefined;
  if (collapsed.has(node.id)) return { ...node, children: [] };
  return { ...node, children: node.children.map((child) => applyCollapsed(child, collapsed) ?? child) };
};

const withPathIds = (
  node: { id?: string; label?: string; summary?: string; theses?: string[]; importance?: "high" | "medium" | "low"; nodeType?: string; children?: unknown[] } | undefined,
  path: string
): CanvasMindNode | undefined => {
  if (!node) return undefined;
  const sourceChildren = Array.isArray(node.children) ? node.children : [];
  return {
    id: String(node.id ?? path),
    __path: path,
    label: node.label,
    summary: node.summary,
    theses: Array.isArray(node.theses) ? node.theses : [],
    importance: node.importance,
    nodeType: node.nodeType,
    children: sourceChildren
      .map((child, index) =>
        withPathIds(
          child as { id?: string; label?: string; summary?: string; theses?: string[]; importance?: "high" | "medium" | "low"; nodeType?: string; children?: unknown[] },
          `${path}.${index}`
        )
      )
      .filter(Boolean) as CanvasMindNode[]
  };
};

const buildChildrenCountMap = (node: CanvasMindNode | undefined): Record<string, number> => {
  if (!node) return {};
  const map: Record<string, number> = {};
  const walk = (current: CanvasMindNode): void => {
    map[current.id] = current.children.length;
    current.children.forEach(walk);
  };
  walk(node);
  return map;
};

const countLeaves = (node: CanvasMindNode | undefined): number => {
  if (!node) return 0;
  if (!node.children.length) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
};

const buildHorizontalDagreLayout = (
  root: d3.HierarchyNode<CanvasMindNode>,
  links: d3.HierarchyLink<CanvasMindNode>[],
  cardWidthById: Map<string, number>
): Map<string, Point> => {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    align: "UL",
    ranksep: 136,
    nodesep: 68,
    edgesep: 24,
    marginx: 40,
    marginy: 36
  });

  root.descendants().forEach((node) => {
    const width = (cardWidthById.get(node.data.id) ?? 140) + 20;
    graph.setNode(node.data.id, { width, height: 42 });
  });

  links.forEach((link) => {
    graph.setEdge(link.source.data.id, link.target.data.id);
  });

  dagre.layout(graph);
  const positions = new Map<string, Point>();
  root.descendants().forEach((node) => {
    const placed = graph.node(node.data.id) as { x: number; y: number } | undefined;
    if (placed) {
      positions.set(node.data.id, { x: placed.x, y: placed.y });
    } else {
      positions.set(node.data.id, { x: safe(node.y), y: safe(node.x) });
    }
  });
  return positions;
};

const applyVerticalAntiCollision = (
  root: d3.HierarchyNode<CanvasMindNode>,
  positions: Map<string, Point>
): void => {
  const levels = new Map<number, d3.HierarchyNode<CanvasMindNode>[]>();
  root.descendants().forEach((node) => {
    const bucket = levels.get(node.depth) ?? [];
    bucket.push(node);
    levels.set(node.depth, bucket);
  });

  levels.forEach((nodes) => {
    const sorted = [...nodes].sort((a, b) => {
      const pa = positions.get(a.data.id);
      const pb = positions.get(b.data.id);
      return safe(pa?.x) - safe(pb?.x);
    });
    let cursor = Number.NEGATIVE_INFINITY;
    sorted.forEach((node) => {
      const current = positions.get(node.data.id);
      if (!current) return;
      const cardHalfWidth = 70;
      const minCenterX = cursor + cardHalfWidth + 24;
      if (current.x < minCenterX) {
        current.x = minCenterX;
        positions.set(node.data.id, current);
      }
      cursor = current.x + cardHalfWidth;
    });
  });
};

const safe = (value: number | undefined): number => value ?? 0;
const polarX = (angle: number | undefined, radius: number | undefined): number => Math.cos((safe(angle) - 90) * (Math.PI / 180)) * safe(radius);
const polarY = (angle: number | undefined, radius: number | undefined): number => Math.sin((safe(angle) - 90) * (Math.PI / 180)) * safe(radius);
