import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

export default function KnowledgeGraph({ dependencyMap }) {
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!dependencyMap) return { initialNodes: [], initialEdges: [] };

    const nodes = [];
    const edges = [];
    const nodeSet = new Set();

    let y = 0;
    let x = 0;

    const addNode = (id) => {
      if (!nodeSet.has(id)) {
        nodeSet.add(id);
        nodes.push({
          id,
          position: { x: (x % 5) * 250, y: Math.floor(y / 5) * 120 },
          data: { label: id.split('/').pop() }, // show only filename
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #8b5cf6',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '12px',
            fontFamily: 'monospace'
          },
        });
        x++;
        y++;
      }
    };

    Object.entries(dependencyMap).forEach(([file, data]) => {
      addNode(file);
      data.imports?.forEach((imp) => {
        // filter out relative paths that start with dot
        const target = imp.startsWith('.') ? imp : imp;
        addNode(target);
        edges.push({
          id: `e-${file}-${target}`,
          source: file,
          target: target,
          animated: true,
          style: { stroke: '#ec4899', strokeWidth: 1.5 },
        });
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [dependencyMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback((params) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

  if (!dependencyMap || Object.keys(dependencyMap).length === 0) {
    return (
      <div className="flex items-center justify-center h-96 bg-white/5 rounded-xl border border-white/10 text-gray-400">
        No dependency graph available.
      </div>
    );
  }

  return (
    <div className="h-[700px] bg-slate-900 rounded-xl border border-white/20 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="dark"
      >
        <Controls />
        <MiniMap nodeStrokeColor="#8b5cf6" nodeColor="#1e293b" maskColor="rgba(0,0,0,0.5)" />
        <Background color="#334155" gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}
