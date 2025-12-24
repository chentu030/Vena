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
    getNodesBounds,
    getViewportForBounds,
    useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Trash, Edit2, Layers, Link2Off, StickyNote, Type, BookOpen, Download, Image as ImageIcon, FileImage } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import MindMapNode from './MindMapNode';
import StickyNoteNode from './StickyNoteNode';
import DescriptionNode from './DescriptionNode';
import ReferenceNode from './ReferenceNode';

// Define Node Types
const nodeTypes = {
    mindMap: MindMapNode,
    stickyNote: StickyNoteNode,
    description: DescriptionNode,
    reference: ReferenceNode,
};

const PRESET_COLORS = [
    '#ffffff', // White
    '#ffcccc', // Red
    '#ffe6cc', // Orange
    '#ffffcc', // Yellow
    '#ccffcc', // Green
    '#ccffff', // Cyan
    '#ccccff', // Blue
    '#e6ccff', // Purple
    '#f5f5f5', // Grey
];

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
    availableGroups?: any[];
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
    setEdges,
    availableGroups = []
}: EditableMindMapProps) {
    const { getNodes } = useReactFlow();
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
    const [selectionDownloadMenuOpen, setSelectionDownloadMenuOpen] = useState(false);

    // Download Image - Simple direct capture
    const downloadImage = async (targetNodes: Node[], format: 'png' | 'jpeg' | 'svg' = 'png', fileName: string = 'mind-map') => {
        if (!ref.current) return;

        const nodesBounds = getNodesBounds(targetNodes);
        const padding = 50;
        const imageWidth = nodesBounds.width + padding * 2;
        const imageHeight = nodesBounds.height + padding * 2;

        const transform = getViewportForBounds(
            nodesBounds,
            imageWidth,
            imageHeight,
            0.5,
            2,
            padding / imageWidth
        );

        // Temporarily deselect all nodes
        const previouslySelectedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
        if (previouslySelectedNodeIds.length > 0) {
            setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        const viewportEl = ref.current.querySelector('.react-flow__viewport') as HTMLElement;
        if (!viewportEl) {
            if (previouslySelectedNodeIds.length > 0) {
                setNodes(nds => nds.map(n => ({ ...n, selected: previouslySelectedNodeIds.includes(n.id) })));
            }
            return;
        }

        // Store original transform
        const originalTransform = viewportEl.style.transform;

        try {
            // Apply export transform
            viewportEl.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.zoom})`;

            await new Promise(resolve => setTimeout(resolve, 100));

            const { toPng, toJpeg, toSvg } = await import('html-to-image');

            const options = {
                backgroundColor: '#f9fafb',
                width: imageWidth,
                height: imageHeight,
                pixelRatio: 2,
                filter: (node: any) => {
                    if (node.classList) {
                        const exclude = ['react-flow__minimap', 'react-flow__controls', 'react-flow__panel',
                            'react-flow__resize-control', 'react-flow__nodesselection',
                            'react-flow__attribution'];
                        for (const cls of exclude) {
                            if (node.classList.contains(cls)) return false;
                        }
                    }
                    return true;
                },
            };

            let dataUrl: string;
            if (format === 'svg') {
                dataUrl = await toSvg(viewportEl, options);
            } else if (format === 'jpeg') {
                dataUrl = await toJpeg(viewportEl, { ...options, quality: 0.95 });
            } else {
                dataUrl = await toPng(viewportEl, options);
            }

            // Restore original transform
            viewportEl.style.transform = originalTransform;

            const a = document.createElement('a');
            a.setAttribute('download', `${fileName}.${format}`);
            a.setAttribute('href', dataUrl);
            a.click();
        } catch (error) {
            console.error('Failed to export image:', error);
            // Restore transform on error
            viewportEl.style.transform = originalTransform;
            alert('匯出失敗，請使用瀏覽器截圖功能');
        } finally {
            if (previouslySelectedNodeIds.length > 0) {
                setNodes(nds => nds.map(n => ({ ...n, selected: previouslySelectedNodeIds.includes(n.id) })));
            }
            setDownloadMenuOpen(false);
            setSelectionDownloadMenuOpen(false);
        }
    };

    // Sync availableGroups to Reference nodes data
    // This ensures Reference nodes always have the latest groups even after async load
    useEffect(() => {
        // Only run if we have groups to sync
        if (!availableGroups || availableGroups.length === 0) return;

        setNodes((nds) => {
            const groupsStr = JSON.stringify(availableGroups);

            // Check if ANY reference node needs updating (missing groups or stale groups)
            const needsUpdate = nds.some(n => {
                if (n.type !== 'reference') return false;
                const currentGroups = n.data.availableGroups as any[] | undefined;
                // Update if no groups, empty groups, or different groups
                if (!currentGroups || currentGroups.length === 0) return true;
                return JSON.stringify(currentGroups) !== groupsStr;
            });

            if (!needsUpdate) return nds;

            console.log('Syncing availableGroups to Reference nodes:', availableGroups.length, 'groups');
            return nds.map((node) => {
                if (node.type === 'reference') {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            availableGroups: availableGroups
                        }
                    };
                }
                return node;
            });
        });
    }, [availableGroups, setNodes]);

    // Context Menu State
    const [menu, setMenu] = useState<{ id: string; type: 'node' | 'edge'; top: number; left: number; direction?: string } | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const [batchAddModal, setBatchAddModal] = useState<{ parentId: string; direction: string } | null>(null);
    const [batchAddCount, setBatchAddCount] = useState(3);
    const [batchNodeType, setBatchNodeType] = useState<'mindMap' | 'reference' | 'description'>('mindMap');

    // Custom Colors State
    const [savedColors, setSavedColors] = useState<string[]>([]);
    const [lastCustomColor, setLastCustomColor] = useState<string | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('mindmap_custom_colors');
        if (saved) {
            try {
                setSavedColors(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load saved colors", e);
            }
        }
    }, []);

    const saveCustomColor = (color: string) => {
        if (!PRESET_COLORS.includes(color) && !savedColors.includes(color)) {
            const newColors = [...savedColors, color];
            setSavedColors(newColors);
            localStorage.setItem('mindmap_custom_colors', JSON.stringify(newColors));
        }
        setLastCustomColor(null);
    };

    const deleteCustomColor = (e: React.MouseEvent, color: string) => {
        e.preventDefault();
        e.stopPropagation();
        const newColors = savedColors.filter(c => c !== color);
        setSavedColors(newColors);
        localStorage.setItem('mindmap_custom_colors', JSON.stringify(newColors));
    };

    // Internal handler to apply color
    const applyColor = (color: string) => {
        // Logic to apply to selected nodes or menu target
        const targetIds = new Set<string>();

        if (menu && menu.type === 'node') {
            targetIds.add(menu.id);
            // If the menu target is also part of selection, apply to all selected
            const targetNode = nodes.find(n => n.id === menu.id);
            if (targetNode && targetNode.selected) {
                nodes.filter(n => n.selected).forEach(n => targetIds.add(n.id));
            }
        } else {
            // Toolbar action - apply to selection
            nodes.filter(n => n.selected).forEach(n => targetIds.add(n.id));
        }

        if (targetIds.size > 0) {
            setNodes((nds) => nds.map(n => {
                if (targetIds.has(n.id)) {
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
    };

    const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const color = e.target.value;
        setLastCustomColor(color);
        applyColor(color);
    };

    // Derived Selection State from Props (Source of Truth)
    const selectedNodes = nodes.filter(n => n.selected);
    const selectedEdges = edges.filter(e => e.selected);

    const onLabelChange = useCallback((id: string, newLabel: string, keepEditing: boolean = false) => {
        setNodes((nds) => nds.map((n) => {
            if (n.id === id) {
                return {
                    ...n,
                    data: { ...n.data, label: newLabel, isEditing: keepEditing }
                };
            }
            return n;
        }));
    }, [setNodes]);

    // State for React Flow Instance
    const [rfInstance, setRfInstance] = useState<any>(null);

    const getCenterPosition = () => {
        if (!rfInstance || !ref.current) {
            return { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 };
        }
        const { left, top, width, height } = ref.current.getBoundingClientRect();
        const centerX = left + width / 2;
        const centerY = top + height / 2;

        // Project screen center to flow coordinates
        const position = rfInstance.screenToFlowPosition({ x: centerX, y: centerY });

        // Add slight random offset to prevent perfect stacking
        return {
            x: position.x + (Math.random() * 40 - 20),
            y: position.y + (Math.random() * 40 - 20)
        };
    };

    const handleAddNode = () => {
        const { x, y } = getCenterPosition();
        const newNode: Node = {
            id: uuidv4(),
            type: 'mindMap',
            position: { x, y },
            data: { label: 'New Node', onLabelChange, color: '#ffffff' },
            style: { background: 'transparent', border: 'none' },
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const handleAddStickyNote = () => {
        const { x, y } = getCenterPosition();
        const newNode: Node = {
            id: uuidv4(),
            type: 'stickyNote',
            position: { x, y },
            data: { label: 'Sticky Note', onLabelChange, color: '#fef3c7' }, // Default yellow
            style: { background: 'transparent', border: 'none' },
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const handleAddDescription = () => {
        const { x, y } = getCenterPosition();
        const newNode: Node = {
            id: uuidv4(),
            type: 'description',
            position: { x, y },
            data: { label: 'Add description...', onLabelChange, color: '#6b7280' },
            style: { background: 'transparent', border: 'none' },
        };
        setNodes((nds) => [...nds, newNode]);
    };

    const handleAddReference = () => {
        const { x, y } = getCenterPosition();
        const newNode: Node = {
            id: uuidv4(),
            type: 'reference',
            position: { x, y },
            data: { label: 'New Reference', onLabelChange, referenceType: 'paper', color: '#faf5ff' },
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
        if (node.type === 'stickyNote' || node.type === 'description' || node.type === 'reference') {
            // Sticky Note, Description & Reference: Double click to edit
            setNodes((nds) => nds.map(n => {
                if (n.id === node.id) return { ...n, data: { ...n.data, isEditing: true } };
                return n;
            }));
        } else {
            // Normal Node: Double click to open chat
            if (onNodeDoubleClick) {
                onNodeDoubleClick(node.id, node.data.label as string);
            }
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
            } else if (menu.id === 'selection') {
                handleToolbarDelete();
            } else {
                const targetNode = nodes.find(n => n.id === menu.id);
                if (targetNode && targetNode.selected) {
                    handleToolbarDelete();
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
            setBatchNodeType('mindMap'); // Reset to default
            setMenu(null);
        }
    };

    // Confirm batch add from modal
    const confirmBatchAdd = () => {
        if (!batchAddModal) return;

        const parentNode = nodes.find(n => n.id === batchAddModal.parentId);
        const dir = batchAddModal.direction;
        const count = batchAddCount;
        const type = batchNodeType;

        if (parentNode && count > 0) {
            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];
            const isReference = type === 'reference';
            const parentIsReference = parentNode.type === 'reference';

            // Get parent dimensions (measured or fallback)
            const parentWidth = parentNode.measured?.width || (parentIsReference ? 350 : 160);
            const parentHeight = parentNode.measured?.height || (parentIsReference ? 250 : 40);
            const parentCenterY = parentNode.position.y + parentHeight / 2;
            const parentCenterX = parentNode.position.x + parentWidth / 2;

            // Increase gaps for reference nodes as they are larger
            const gapX = isReference ? 400 : 250;
            const gapY = isReference ? 120 : 60;
            const horizontalSpan = isReference ? 300 : 180;

            let startX = parentNode.position.x;
            let startY = parentNode.position.y;

            if (dir === 'right') {
                startX = parentNode.position.x + parentWidth + (isReference ? 100 : 80);
                startY = parentCenterY;
            }
            if (dir === 'left') {
                startX = parentNode.position.x - gapX;
                startY = parentCenterY;
            }
            if (dir === 'bottom') {
                startX = parentCenterX;
                startY = parentNode.position.y + parentHeight + (isReference ? 100 : 60);
            }
            if (dir === 'top') {
                startX = parentCenterX;
                startY = parentNode.position.y - (isReference ? 150 : 100);
            }

            const isVerticalStack = dir === 'right' || dir === 'left';
            const totalSpan = isVerticalStack ? count * gapY : count * horizontalSpan;
            const startOffset = -(totalSpan / 2) + (isVerticalStack ? gapY / 2 : horizontalSpan / 2);

            for (let i = 0; i < count; i++) {
                let x = startX;
                let y = startY;

                if (isVerticalStack) {
                    y = startY + startOffset + (i * gapY);
                } else {
                    x = startX + startOffset + (i * horizontalSpan);
                }

                const nodeId = uuidv4();

                let newNodeData: any = { label: `Node ${i + 1}`, onLabelChange, color: '#ffffff' };
                let newNodeStyle = { background: 'transparent', border: 'none' };

                if (type === 'reference') {
                    newNodeData = {
                        label: 'New Reference',
                        onLabelChange,
                        referenceType: 'paper',
                        color: '#faf5ff',
                        availableGroups: availableGroups // Ensure groups are passed initially
                    };
                } else if (type === 'description') {
                    newNodeData = { label: 'Description...', onLabelChange, color: '#6b7280' };
                }

                newNodes.push({
                    id: nodeId,
                    type: type,
                    position: { x, y },
                    data: newNodeData,
                    style: newNodeStyle,
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
                onPaneClick={onPaneClick}
                onPaneContextMenu={onPaneContextMenu}
                onInit={setRfInstance} // Capture instance
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
                    <button onClick={handleAddStickyNote} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition" title="Add Sticky Note">
                        <StickyNote size={16} />
                    </button>
                    <button onClick={handleAddDescription} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition" title="Add Description Text">
                        <Type size={16} />
                    </button>
                    <button onClick={handleAddReference} className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition" title="Add Reference/Database">
                        <BookOpen size={16} />
                    </button>

                    {/* Divider */}
                    <div className="w-px bg-neutral-200 dark:bg-neutral-700 mx-1"></div>

                    {/* Download Full Map Button */}
                    <div className="relative">
                        <button
                            onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded transition flex items-center gap-1"
                            title="Download Map"
                        >
                            <Download size={16} />
                        </button>

                        {downloadMenuOpen && (
                            <div className="absolute top-full right-0 mt-2 bg-white dark:bg-neutral-800 border border-border rounded-lg shadow-xl p-1 flex flex-col min-w-[120px] z-50">
                                <button onClick={() => downloadImage(nodes, 'png', 'mind-map')} className="px-3 py-2 text-sm text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded flex items-center gap-2">
                                    <ImageIcon size={14} /> PNG
                                </button>
                                <button onClick={() => downloadImage(nodes, 'jpeg', 'mind-map')} className="px-3 py-2 text-sm text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded flex items-center gap-2">
                                    <FileImage size={14} /> JPG
                                </button>
                                <button onClick={() => downloadImage(nodes, 'svg', 'mind-map')} className="px-3 py-2 text-sm text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded flex items-center gap-2">
                                    <Layers size={14} /> SVG
                                </button>
                            </div>
                        )}
                        {/* Overlay to close menu */}
                        {downloadMenuOpen && (
                            <div className="fixed inset-0 z-40" onClick={() => setDownloadMenuOpen(false)}></div>
                        )}
                    </div>
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
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {[...PRESET_COLORS, ...savedColors].map(color => (
                                            <div key={color} className="relative group/color">
                                                <button
                                                    onClick={() => applyColor(color)}
                                                    className="w-5 h-5 rounded-full border border-neutral-200 shadow-sm hover:scale-110 hover:z-10 transition ring-offset-1 focus:ring-2"
                                                    style={{ backgroundColor: color }}
                                                    title={color}
                                                />
                                                {savedColors.includes(color) && (
                                                    <button
                                                        onClick={(e) => deleteCustomColor(e, color)}
                                                        className="absolute -top-2 -right-2 hidden group-hover/color:flex bg-red-500 text-white rounded-full w-4 h-4 items-center justify-center text-[10px] shadow-sm z-20"
                                                        title="Remove color"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))}

                                        {/* Color Picker Input */}
                                        <div className="relative w-5 h-5 rounded-full overflow-hidden border border-neutral-300 shadow-sm hover:scale-110 transition cursor-pointer group bg-white">
                                            <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-green-400 to-blue-400 opacity-50"></div>
                                            <input
                                                type="color"
                                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full p-0 border-0"
                                                onChange={handleCustomColorChange}
                                                title="Pick Custom Color"
                                            />
                                        </div>

                                        {/* Add Button - Only shows when lastCustomColor is active and not saved */}
                                        {lastCustomColor && !savedColors.includes(lastCustomColor) && !PRESET_COLORS.includes(lastCustomColor) && (
                                            <button
                                                onClick={() => saveCustomColor(lastCustomColor)}
                                                className="w-5 h-5 rounded-full border border-dashed border-neutral-400 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 flex items-center justify-center transition shadow-sm"
                                                title="Save Current Color"
                                            >
                                                <span className="text-xs font-bold leading-none mb-px">+</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="w-px h-6 bg-border mx-1"></div>
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

                            <div className="w-px h-6 bg-border mx-1"></div>

                            {/* Download Selection */}
                            <div className="relative">
                                <button
                                    onClick={() => setSelectionDownloadMenuOpen(!selectionDownloadMenuOpen)}
                                    className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 rounded transition flex items-center gap-1"
                                    title="Download Selection"
                                >
                                    <Download size={16} />
                                </button>
                                {selectionDownloadMenuOpen && (
                                    <div className="absolute top-full right-0 mt-2 bg-white dark:bg-neutral-800 border border-border rounded-lg shadow-xl p-1 flex flex-col min-w-[100px] z-50">
                                        <button onClick={() => downloadImage(selectedNodes, 'png', 'selection')} className="px-2 py-1.5 text-xs text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded">Export PNG</button>
                                        <button onClick={() => downloadImage(selectedNodes, 'jpeg', 'selection')} className="px-2 py-1.5 text-xs text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded">Export JPG</button>
                                        <button onClick={() => downloadImage(selectedNodes, 'svg', 'selection')} className="px-2 py-1.5 text-xs text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded">Export SVG</button>
                                    </div>
                                )}
                                {selectionDownloadMenuOpen && (
                                    <div className="fixed inset-0 z-40" onClick={() => setSelectionDownloadMenuOpen(false)}></div>
                                )}
                            </div>
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
                                <div className="grid grid-cols-3 gap-1.5 px-2 py-1">
                                    {[...PRESET_COLORS, ...savedColors].map(color => (
                                        <div key={color} className="relative group/color">
                                            <button
                                                onClick={() => applyColor(color)}
                                                className="w-5 h-5 rounded-full border border-neutral-200 shadow-sm hover:scale-110 transition"
                                                style={{ backgroundColor: color }}
                                            />
                                            {savedColors.includes(color) && (
                                                <button
                                                    onClick={(e) => deleteCustomColor(e, color)}
                                                    className="absolute -top-1 -right-1 hidden group-hover/color:flex bg-red-500 text-white rounded-full w-3 h-3 items-center justify-center text-[8px] shadow-sm z-20"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {/* Color Picker Input Context Menu */}
                                    <div className="relative w-5 h-5 rounded-full overflow-hidden border border-neutral-300 shadow-sm hover:scale-110 transition cursor-pointer group bg-white">
                                        <div className="absolute inset-0 bg-gradient-to-br from-red-400 via-green-400 to-blue-400 opacity-50"></div>
                                        <input
                                            type="color"
                                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full p-0 border-0"
                                            onChange={handleCustomColorChange}
                                            title="Pick Custom Color"
                                        />
                                    </div>

                                    {/* Add Button - Context Menu */}
                                    {lastCustomColor && !savedColors.includes(lastCustomColor) && !PRESET_COLORS.includes(lastCustomColor) && (
                                        <button
                                            onClick={() => saveCustomColor(lastCustomColor)}
                                            className="w-5 h-5 rounded-full border border-dashed border-neutral-400 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 flex items-center justify-center transition shadow-sm"
                                            title="Save Current Color"
                                        >
                                            <span className="text-xs font-bold leading-none mb-px">+</span>
                                        </button>
                                    )}
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

                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2 text-neutral-700 dark:text-neutral-300">
                                Node Type
                            </label>
                            <select
                                value={batchNodeType}
                                onChange={(e) => setBatchNodeType(e.target.value as any)}
                                className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            >
                                <option value="mindMap">Standard Node</option>
                                <option value="reference">Reference / Paper</option>
                                <option value="description">Description Text</option>
                            </select>
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
