import React, { useCallback, useState, useRef, useEffect } from 'react';
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    Connection,
    Edge,
    Node,
    Panel,
    ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Trash, Edit2, Layers, Link2Off } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import MindMapNode from './MindMapNode';

// Define Node Types
const nodeTypes = {
    mindMap: MindMapNode,
};

interface EditableMindMapProps {
    nodes: Node[];
    edges: Edge[];
    onNodesChange: (changes: any) => void;
    onEdgesChange: (changes: any) => void;
    onConnect: (connection: Connection) => void;
    onNodeClick: (id: string, label: string) => void;
    onNodeDoubleClick?: (id: string, label: string) => void;
    setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
    setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
}

export default function EditableMindMap({
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onNodeDoubleClick,
    setNodes,
    setEdges
}: EditableMindMapProps) {

    // Context Menu State
    const [menu, setMenu] = useState<{ id: string; type: 'node' | 'edge'; top: number; left: number; direction?: string } | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    // Batch Add Modal State
    const [batchAddModal, setBatchAddModal] = useState<{ parentId: string; direction: string } | null>(null);
    const [batchAddCount, setBatchAddCount] = useState(3);

    // Derived Selection State from Props (Source of Truth)
    const selectedNodes = nodes.filter(n => n.selected);
    const selectedEdges = edges.filter(e => e.selected);

    const onLabelChange = useCallback((id: string, newLabel: string) => {
        setNodes((nds) => nds.map((n) => {
            if (n.id === id) {
                return {
                    ...n,
                    data: { ...n.data, label: newLabel, isEditing: false }
                };
            }
            return n;
        }));
    }, [setNodes]);

    const handleAddNode = () => {
        const newNode: Node = {
            id: uuidv4(),
            type: 'mindMap',
            position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
            data: { label: 'New Node', onLabelChange, color: '#ffffff' },
            style: { background: 'transparent', border: 'none' },
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const onNodeContextMenu = useCallback(
        (event: React.MouseEvent, node: Node) => {
            event.preventDefault();
            if (ref.current) {
                const pane = ref.current.getBoundingClientRect();
                const targetEl = (event.target as HTMLElement).closest('.react-flow__node');
                let direction: 'top' | 'right' | 'bottom' | 'left' = 'right';

                if (targetEl) {
                    const rect = targetEl.getBoundingClientRect();
                    const x = event.clientX - rect.left;
                    const y = event.clientY - rect.top;
                    const w = rect.width;
                    const h = rect.height;

                    const distTop = y;
                    const distBottom = h - y;
                    const distLeft = x;
                    const distRight = w - x;
                    const min = Math.min(distTop, distBottom, distLeft, distRight);

                    if (min === distTop) direction = 'top';
                    else if (min === distBottom) direction = 'bottom';
                    else if (min === distLeft) direction = 'left';
                    else direction = 'right';
                }

                setMenu({
                    id: node.id,
                    type: 'node',
                    top: event.clientY - pane.top,
                    left: event.clientX - pane.left,
                    direction
                });
            }
        },
        [setMenu],
    );

    const onEdgeContextMenu = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
            event.preventDefault();
            if (ref.current) {
                const pane = ref.current.getBoundingClientRect();
                setMenu({
                    id: edge.id,
                    type: 'edge',
                    top: event.clientY - pane.top,
                    left: event.clientX - pane.left,
                });
            }
        },
        [setMenu]
    );

    const onPaneContextMenu = useCallback(
        (event: React.MouseEvent | MouseEvent) => {
            event.preventDefault();

            // If we have a selection, show the menu for the selection
            if (selectedNodes.length > 0) {
                if (ref.current) {
                    const pane = ref.current.getBoundingClientRect();
                    setMenu({
                        id: 'selection', // Special ID for selection
                        type: 'node', // Reuse node type for now as it has similar actions
                        top: event.clientY - pane.top,
                        left: event.clientX - pane.left,
                    });
                }
            } else {
                setMenu(null);
            }
        },
        [selectedNodes, setMenu]
    );

    const onPaneClick = useCallback(() => setMenu(null), [setMenu]);
    const onNodeClickInternal = (event: React.MouseEvent, node: Node) => {
        setMenu(null);
        onNodeClick(node.id, node.data.label as string);
    };

    const onNodeDoubleClickInternal = (event: React.MouseEvent, node: Node) => {
        setMenu(null);
        if (onNodeDoubleClick) {
            onNodeDoubleClick(node.id, node.data.label as string);
        }
    };

    // Context Menu Actions
    const handleMenuRename = () => {
        if (menu && menu.type === 'node') {
            setNodes((nds) => nds.map(n => {
                if (n.id === menu.id) return { ...n, data: { ...n.data, isEditing: true } };
                return n;
            }));
            setMenu(null);
        }
    };

    const handleMenuDelete = () => {
        if (menu) {
            if (menu.type === 'edge') {
                setEdges((eds) => eds.filter(e => e.id !== menu.id));
            } else {
                const targetNode = nodes.find(n => n.id === menu.id);
                if (targetNode && targetNode.selected) {
                    const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
                    setNodes((nds) => nds.filter((n) => !selectedIds.has(n.id)));
                    setEdges((eds) => eds.filter((e) => !selectedIds.has(e.source) && !selectedIds.has(e.target)));
                } else {
                    setNodes((nds) => nds.filter((n) => n.id !== menu.id));
                    setEdges((eds) => eds.filter((e) => e.source !== menu.id && e.target !== menu.id));
                }
            }
            setMenu(null);
        }
    };

    const handleMenuDisconnect = () => {
        // If menu type is selection (id='selection'), we check derived selection state directly.
        const selectedIds = new Set(selectedNodes.map(n => n.id));

        if (selectedIds.size > 1) {
            setEdges((eds) => eds.filter((e) => !(selectedIds.has(e.source) && selectedIds.has(e.target))));
        }
        setMenu(null);
    };

    const handleMenuColor = (color: string) => {
        if (menu && menu.type === 'node') {
            const targetNode = nodes.find(n => n.id === menu.id);
            if (targetNode && targetNode.selected) {
                const selectedIds = new Set(nodes.filter(n => n.selected).map(n => n.id));
                setNodes((nds) => nds.map(n => {
                    if (selectedIds.has(n.id)) {
                        return {
                            ...n,
                            style: { ...n.style, background: 'transparent', border: 'none' },
                            data: { ...n.data, color }
                        };
                    }
                    return n;
                }));
            } else {
                setNodes((nds) => nds.map(n => {
                    if (n.id === menu.id) {
                        return {
                            ...n,
                            style: { ...n.style, background: 'transparent', border: 'none' },
                            data: { ...n.data, color }
                        };
                    }
                    return n;
                }));
            }
            setMenu(null);
        }
    };

    const handleMenuBatchAdd = () => {
        if (menu && menu.type === 'node') {
            const dir = (menu as any).direction || 'right';
            // Open modal instead of window.prompt
            setBatchAddModal({ parentId: menu.id, direction: dir });
            setBatchAddCount(3); // Reset to default
            setMenu(null);
        }
    };

    // Confirm batch add from modal
    const confirmBatchAdd = () => {
        if (!batchAddModal) return;

        const parentNode = nodes.find(n => n.id === batchAddModal.parentId);
        const dir = batchAddModal.direction;
        const count = batchAddCount;

        if (parentNode && count > 0) {
            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];
            const gapX = 200;
            const gapY = 60;
            let startX = parentNode.position.x;
            let startY = parentNode.position.y;

            if (dir === 'right') startX += gapX;
            if (dir === 'left') startX -= gapX;
            if (dir === 'bottom') startY += 100;
            if (dir === 'top') startY -= 100;

            const isVerticalStack = dir === 'right' || dir === 'left';
            const totalSpan = isVerticalStack ? count * gapY : count * 160;
            const startOffset = -(totalSpan / 2) + (isVerticalStack ? gapY / 2 : 80);

            for (let i = 0; i < count; i++) {
                let x = startX;
                let y = startY;

                if (isVerticalStack) {
                    y = parentNode.position.y + startOffset + (i * gapY);
                } else {
                    x = parentNode.position.x + startOffset + (i * 160);
                }

                const nodeId = uuidv4();
                newNodes.push({
                    id: nodeId,
                    type: 'mindMap',
                    position: { x, y },
                    data: { label: `Node ${i + 1}`, onLabelChange, color: '#ffffff' },
                    style: { background: 'transparent', border: 'none' },
                });

                let sourceHandle = 'right';
                let targetHandle = 'left';
                if (dir === 'left') { sourceHandle = 'left'; targetHandle = 'right'; }
                if (dir === 'bottom') { sourceHandle = 'bottom'; targetHandle = 'top'; }
                if (dir === 'top') { sourceHandle = 'top'; targetHandle = 'bottom'; }

                newEdges.push({
                    id: `e-${parentNode.id}-${nodeId}`,
                    source: parentNode.id,
                    target: nodeId,
                    sourceHandle,
                    targetHandle,
                });
            }
            setNodes(nds => [...nds, ...newNodes]);
            setEdges(eds => [...eds, ...newEdges]);
        }
        setBatchAddModal(null);
    };

    // Selection Toolbar Actions
    const handleToolbarDelete = () => {
        const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
        const selectedEdgeIds = new Set(selectedEdges.map(e => e.id));

        if (selectedNodeIds.size > 0 || selectedEdgeIds.size > 0) {
            setNodes((nds) => nds.filter((n) => !selectedNodeIds.has(n.id)));
            setEdges((eds) => eds.filter((e) => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)));
        }
    };

    const handleToolbarColor = (color: string) => {
        const selectedIds = new Set(selectedNodes.map(n => n.id));
        if (selectedIds.size > 0) {
            setNodes((nds) => nds.map(n => {
                if (selectedIds.has(n.id)) {
                    return {
                        ...n,
                        style: { ...n.style, background: 'transparent', border: 'none' },
                        data: { ...n.data, color }
                    };
                }
                return n;
            }));
        }
    };

    const handleToolbarDisconnect = () => {
        const selectedIds = new Set(selectedNodes.map(n => n.id));
        if (selectedIds.size > 1) {
            setEdges((eds) => eds.filter((e) => !(selectedIds.has(e.source) && selectedIds.has(e.target))));
        }
    };

    // Manual Space-Pan Logic
    const [isPanning, setIsPanning] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                setIsPanning(true);
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space') {
                setIsPanning(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Container-level context menu handler (Capture Phase)
    // This catches right-clicks BEFORE they reach React Flow's internal elements (like Selection Overlay).
    const handleContainerContextMenu = (event: React.MouseEvent) => {
        const target = event.target as HTMLElement;

        // Use 'closest' to check if we clicked on a relevant interactive element.
        // We want to RESPECT specific handlers for Nodes, Edges, and UI Panels (MiniMap/Controls).
        // If the target is one of these, we return and let the event bubble to their listeners.
        // Also check if the click target is part of the context menu itself, to avoid blocking interactions there (though unlikely for contextmenu event).
        const isNode = target.closest('.react-flow__node');
        const isEdge = target.closest('.react-flow__edge');
        const isPanel = target.closest('.react-flow__panel');
        const isControl = target.closest('.react-flow__controls');

        if (isNode || isEdge || isPanel || isControl) {
            return;
        }

        // If we get here, we are clicking on the Background (Pane) or the Selection Overlay.
        // We force-prevent default to stop the browser menu.
        event.preventDefault();
        event.stopPropagation();

        // Check if we have a selection (this acts as a "selection context menu")
        if (selectedNodes.length > 0) {
            if (ref.current) {
                const pane = ref.current.getBoundingClientRect();
                setMenu({
                    id: 'selection',
                    type: 'node',
                    top: event.clientY - pane.top,
                    left: event.clientX - pane.left,
                });
            }
        } else {
            // Clicked on background with no selection -> Close menu
            // This replaces onPaneClick/onPaneContextMenu default behavior for background right-clicks
            setMenu(null);
        }
    };

    return (
        <div
            style={{ width: '100%', height: '100%', cursor: isPanning ? 'grab' : 'default' }}
            ref={ref}
            onContextMenuCapture={handleContainerContextMenu}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClickInternal}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeContextMenu={onEdgeContextMenu}
                onNodeDoubleClick={onNodeDoubleClickInternal}
                // onSelectionChange is no longer needed for state, ReactFlow updates nodes directly with selected: true
                onPaneClick={onPaneClick}
                onPaneContextMenu={onPaneContextMenu}
                nodeTypes={nodeTypes}
                fitView
                connectionMode={ConnectionMode.Loose}

                // Manual Control
                panOnDrag={isPanning}
                selectionOnDrag={!isPanning}
                selectionMode={"partial" as any}
                panOnScroll={true}

                // Disable built-in key logic
                panActivationKeyCode={undefined}
            >
                <Controls />
                <MiniMap nodeColor={(node) => '#555555'} maskColor="rgb(0,0,0, 0.4)" />
                <Background gap={12} size={1} />

                <Panel position="top-right" className="bg-white dark:bg-neutral-800 p-2 rounded-lg shadow-md border border-border flex gap-2">
                    <button onClick={handleAddNode} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition" title="Add Node">
                        <Plus size={16} />
                    </button>
                </Panel>

                {/* Selection Toolbar */}
                {(selectedNodes.length > 0 || selectedEdges.length > 0) && (
                    <Panel position="top-center" className="bg-white dark:bg-neutral-800 p-2 rounded-lg shadow-xl border border-border flex gap-2 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground mr-2">
                                {selectedNodes.length} N / {selectedEdges.length} E
                            </span>

                            {selectedNodes.length > 0 && (
                                <>
                                    <div className="flex -space-x-1">
                                        <button onClick={() => handleToolbarColor('#ffffff')} className="w-5 h-5 rounded-full bg-white border border-neutral-200 shadow-sm hover:scale-110 hover:z-10 transition" title="White"></button>
                                        <button onClick={() => handleToolbarColor('#ffcccc')} className="w-5 h-5 rounded-full bg-red-200 border border-neutral-200 shadow-sm hover:scale-110 hover:z-10 transition" title="Red"></button>
                                        <button onClick={() => handleToolbarColor('#ccffcc')} className="w-5 h-5 rounded-full bg-green-200 border border-neutral-200 shadow-sm hover:scale-110 hover:z-10 transition" title="Green"></button>
                                        <button onClick={() => handleToolbarColor('#ccccff')} className="w-5 h-5 rounded-full bg-blue-200 border border-neutral-200 shadow-sm hover:scale-110 hover:z-10 transition" title="Blue"></button>
                                    </div>
                                    <div className="w-px h-4 bg-border mx-1"></div>
                                </>
                            )}

                            {selectedNodes.length > 1 && (
                                <>
                                    <button onClick={handleToolbarDisconnect} className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 rounded transition flex items-center gap-1" title="Disconnect Selected Nodes">
                                        <Link2Off size={16} />
                                        <span className="text-xs font-medium">Unlink</span>
                                    </button>
                                    <div className="w-px h-4 bg-border mx-1"></div>
                                </>
                            )}

                            <button onClick={handleToolbarDelete} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded transition flex items-center gap-1" title="Delete Selected">
                                <Trash size={16} />
                                <span className="text-xs font-medium">Delete</span>
                            </button>
                        </div>
                    </Panel>
                )}

                {/* Custom Context Menu */}
                {menu && (
                    <div
                        className="absolute z-50 bg-white dark:bg-neutral-800 border border-border rounded-lg shadow-xl p-2 flex flex-col gap-1 w-48 animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: menu.top, left: menu.left }}
                    >
                        <div className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                            {menu.type === 'node' ? 'Node Actions' : 'Connection Actions'}
                        </div>

                        {menu.type === 'node' && (
                            <>
                                {menu.id !== 'selection' && (
                                    <>
                                        <button onClick={handleMenuBatchAdd} className="flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-sm text-left">
                                            <Layers size={14} /> Add Multiple
                                        </button>
                                        <button onClick={handleMenuRename} className="flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-sm text-left">
                                            <Edit2 size={14} /> Rename
                                        </button>
                                    </>
                                )}
                                {selectedNodes.length > 1 && (
                                    <button onClick={handleMenuDisconnect} className="flex items-center gap-2 px-2 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded text-sm text-left text-neutral-600">
                                        <Link2Off size={14} /> Unlink Selected
                                    </button>
                                )}
                            </>
                        )}

                        <button onClick={handleMenuDelete} className="flex items-center gap-2 px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded text-sm text-left">
                            <Trash size={14} /> Delete
                        </button>

                        {menu.type === 'node' && (
                            <>
                                <div className="h-px bg-border my-1"></div>
                                <div className="flex justify-between px-2 py-1">
                                    <button onClick={() => handleMenuColor('#ffffff')} className="w-6 h-6 rounded-full bg-white border border-neutral-200 shadow-sm hover:scale-110 transition"></button>
                                    <button onClick={() => handleMenuColor('#ffcccc')} className="w-6 h-6 rounded-full bg-red-200 border border-neutral-200 shadow-sm hover:scale-110 transition"></button>
                                    <button onClick={() => handleMenuColor('#ccffcc')} className="w-6 h-6 rounded-full bg-green-200 border border-neutral-200 shadow-sm hover:scale-110 transition"></button>
                                    <button onClick={() => handleMenuColor('#ccccff')} className="w-6 h-6 rounded-full bg-blue-200 border border-neutral-200 shadow-sm hover:scale-110 transition"></button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </ReactFlow>

            {/* Custom Modal for Batch Add */}
            {batchAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl p-6 w-80 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-semibold mb-4 text-neutral-800 dark:text-white">
                            Add Multiple Nodes
                        </h3>
                        <p className="text-sm text-muted-foreground mb-4">
                            Add nodes to the <span className="font-medium text-blue-500">{batchAddModal.direction.toUpperCase()}</span>
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                Number of nodes
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={20}
                                value={batchAddCount}
                                onChange={(e) => setBatchAddCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                                autoFocus
                            />
                        </div>
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setBatchAddModal(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBatchAdd}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition"
                            >
                                Add {batchAddCount} Nodes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
