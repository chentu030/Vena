import React, { useState, useEffect, useCallback } from 'react';
import EditableMindMap from './EditableMindMap';
import ChatInterface, { Message } from './ChatInterface';
import { ArrowLeft, MessageSquare, Map as MapIcon } from 'lucide-react';
import { Node, Edge, useNodesState, useEdgesState, addEdge, Connection } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

interface SystemMapPanelProps {
    mindMapData: { nodes: Node[], edges: Edge[] } | null;
    onSave?: (data: { nodes: Node[], edges: Edge[] }) => void;
    initialNodeChats?: NodeChatHistory | null;
    onSaveChats?: (chats: NodeChatHistory) => void;
}

interface NodeChatHistory {
    [nodeId: string]: Message[];
}

const SystemMapPanel: React.FC<SystemMapPanelProps> = ({ mindMapData, onSave, initialNodeChats, onSaveChats }) => {
    const [view, setView] = useState<'map' | 'chat'>('map');
    const [activeNode, setActiveNode] = useState<{ id: string; label: string } | null>(null);
    const [nodeChats, setNodeChats] = useState<NodeChatHistory>({});
    const [isLoading, setIsLoading] = useState(false);

    // Load Initial Chats from Prop (History Sidebar) or LocalStorage
    useEffect(() => {
        if (initialNodeChats) {
            setNodeChats(initialNodeChats);
        } else {
            const saved = localStorage.getItem('node_chats');
            if (saved) {
                try {
                    setNodeChats(JSON.parse(saved));
                } catch (e) { console.error("Failed to load node chats", e); }
            }
        }
    }, [initialNodeChats]);

    // Save Chats (Local + Auto-Save to History)
    useEffect(() => {
        if (Object.keys(nodeChats).length > 0) {
            localStorage.setItem('node_chats', JSON.stringify(nodeChats));

            // Auto-save debounce for HistorySidebar
            const timer = setTimeout(() => {
                if (onSaveChats) onSaveChats(nodeChats);
            }, 3000); // 3 seconds debounce for chats

            return () => clearTimeout(timer);
        }
    }, [nodeChats, onSaveChats]);

    // React Flow State (Local persistence)
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    // Define onLabelChange callback for MindMapNode - MUST be defined BEFORE use in useEffect
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

    // Init from props or local storage
    // IMPORTANT: Inject the onLabelChange callback into all loaded nodes
    useEffect(() => {
        const injectCallbacks = (loadedNodes: Node[]): Node[] => {
            return loadedNodes.map(node => ({
                ...node,
                data: { ...node.data, onLabelChange }
            }));
        };

        const savedMap = localStorage.getItem('mind_map_data');
        if (savedMap) {
            try {
                const parsed = JSON.parse(savedMap);
                setNodes(injectCallbacks(parsed.nodes || []));
                setEdges(parsed.edges || []);
            } catch (e) { }
        } else if (mindMapData) {
            setNodes(injectCallbacks(mindMapData.nodes));
            setEdges(mindMapData.edges);
        }
    }, [mindMapData, setNodes, setEdges, onLabelChange]);



    // Persistence Effect - Save whenever nodes/edges change
    useEffect(() => {
        if (nodes.length > 0 || edges.length > 0) {
            localStorage.setItem('mind_map_data', JSON.stringify({ nodes, edges }));

            // Auto-save debounce
            const timer = setTimeout(() => {
                if (onSave) onSave({ nodes, edges });
            }, 2000); // 2 seconds debounce

            return () => clearTimeout(timer);
        }
    }, [nodes, edges, onSave]);


    const handleNodeClick = (id: string, label: string) => {
        setActiveNode({ id, label });
        // setView('chat'); // Removed to allow selection interactions without navigating away

        if (!nodeChats[id]) {
            setNodeChats(prev => ({
                ...prev,
                [id]: [
                    { role: 'system', content: `Chat for node: **${label}**` },
                    { role: 'model', content: `Hello! I'm here to discuss "${label}". What would you like to know?` }
                ]
            }));
        }
    };

    const handleNodeDoubleClick = (id: string, label: string) => {
        handleNodeClick(id, label); // Ensure initialized
        setView('chat');
    };

    // Helper to get the subgraph (node and its descendants)
    const getSubgraph = (rootId: string) => {
        const subgraphNodeIds = new Set<string>([rootId]);
        const stack = [rootId];

        // Simple BFS to find all descendants
        while (stack.length > 0) {
            const currentId = stack.pop()!;
            const children = edges
                .filter(e => e.source === currentId)
                .map(e => e.target);

            children.forEach(childId => {
                if (!subgraphNodeIds.has(childId)) {
                    subgraphNodeIds.add(childId);
                    stack.push(childId);
                }
            });
        }

        const subNodes = nodes.filter(n => subgraphNodeIds.has(n.id)).map(n => ({ id: n.id, label: n.data.label }));
        const subEdges = edges.filter(e => subgraphNodeIds.has(e.source) && subgraphNodeIds.has(e.target));

        return { nodes: subNodes, edges: subEdges, allowedIds: subgraphNodeIds };
    };

    const handleSendMessage = async (text: string) => {
        if (!activeNode) return;

        const nodeId = activeNode.id;
        const currentHistory = nodeChats[nodeId] || [];

        // Optimistically update UI with user message
        const newHistoryWithUser = [...currentHistory, { role: 'user', content: text }];
        setNodeChats(prev => ({ ...prev, [nodeId]: newHistoryWithUser }));
        setIsLoading(true);

        try {
            // 1. Prepare Context (Subgraph)
            const { nodes: subNodes, allowedIds } = getSubgraph(nodeId);
            const contextPrompt = `
[SYSTEM_DATA]
You are managing the node "${activeNode.label}" (ID: ${nodeId}) and its descendants.
Current Subgraph Structure: ${JSON.stringify(subNodes)}

You can modify this structure using the following JSON commands found in your response:
1. Rename a node: <<<ACTION: {"type": "UPDATE_NODE", "id": "TARGET_ID", "label": "NEW_LABEL"}>>>
2. Add a child:   <<<ACTION: {"type": "ADD_CHILD", "parentId": "PARENT_ID", "label": "NEW_NODE_LABEL"}>>>

RULES:
- You usually perform the action and then briefly confirm it in text.
- You can ONLY modify/add capabilities for nodes listed in the Current Subgraph.
- "parentId" must be one of the existing nodes in the subgraph.
- Do not output markdown code blocks for the action, just the raw string <<<ACTION: ...>>>.
[/SYSTEM_DATA]
`;

            const historyForApi = newHistoryWithUser.map(m => ({
                role: m.role === 'model' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

            // Inject context into the last message or as a separate system-like prompt
            // Gemini API handles context best if appended to the prompt logic
            const actualPrompt = text + contextPrompt;

            const response = await fetch('/api/gemini', {
                method: 'POST',
                body: JSON.stringify({
                    task: 'chat',
                    history: historyForApi.slice(0, -1), // Send history excluding exact last msg to avoid dup if we were to merge, but here we just send history normally? 
                    // Actually, simpler: send history as is, and the prompt is the *next* turn. 
                    // But our API route structure uses `prompt` as the new message.
                    // Let's pass the modified prompt.
                    // NOTE: Depending on how the API route constructs chat, we might need to be careful.
                    // API route: history + sendMessage(prompt). Correct.
                    prompt: actualPrompt
                })
            });

            const data = await response.json();
            let rawReply = data.text || "";

            // 2. Parse Actions
            const actionRegex = /<<<ACTION:\s*({.*?})>>>/g;
            let finalReply = rawReply;
            let match;

            const actionsToExecute: any[] = [];

            // Extract all actions
            while ((match = actionRegex.exec(rawReply)) !== null) {
                try {
                    const actionJson = JSON.parse(match[1]);
                    actionsToExecute.push(actionJson);
                    // Remove the action string from the displayed text
                    finalReply = finalReply.replace(match[0], '').trim();
                } catch (e) {
                    console.error("Failed to parse AI action", e);
                }
            }

            // 3. Execute Actions (with validation)
            if (actionsToExecute.length > 0) {
                let nodesChanged = false;
                let edgesChanged = false;

                actionsToExecute.forEach(action => {
                    if (action.type === 'UPDATE_NODE') {
                        if (allowedIds.has(action.id)) {
                            // Execute Update
                            setNodes(nds => nds.map(n =>
                                n.id === action.id ? { ...n, data: { ...n.data, label: action.label } } : n
                            ));
                            // If we updated the active node, update that state too
                            if (action.id === activeNode.id) {
                                setActiveNode(prev => prev ? { ...prev, label: action.label } : null);
                            }
                        }
                    } else if (action.type === 'ADD_CHILD') {
                        if (allowedIds.has(action.parentId)) {
                            const parent = nodes.find(n => n.id === action.parentId);
                            if (parent) {
                                // Determine direction based on incoming edge
                                const incomingEdge = edges.find(e => e.target === action.parentId);
                                let dir = 'right'; // Default to right

                                if (incomingEdge && incomingEdge.targetHandle) {
                                    // If parent recieved connection on Left, it flows Right.
                                    // If parent recieved connection on Right, it flows Left.
                                    if (incomingEdge.targetHandle === 'left') dir = 'right';
                                    if (incomingEdge.targetHandle === 'right') dir = 'left';
                                    if (incomingEdge.targetHandle === 'top') dir = 'bottom';
                                    if (incomingEdge.targetHandle === 'bottom') dir = 'top';
                                }

                                const gapX = 200;
                                const gapY = 80;
                                let x = parent.position.x;
                                let y = parent.position.y;

                                // Calculate position based on direction
                                // adding a small random Y offset to prevent perfect overlap if adding multiple
                                const offset = (Math.random() * 60 - 30);

                                if (dir === 'right') {
                                    x += gapX;
                                    y += offset;
                                } else if (dir === 'left') {
                                    x -= gapX;
                                    y += offset;
                                } else if (dir === 'bottom') {
                                    y += gapY; // vertical gap
                                    x += offset; // horizontal offset for vertical flow
                                } else if (dir === 'top') {
                                    y -= gapY;
                                    x += offset;
                                }

                                const newId = uuidv4();
                                const newNode: Node = {
                                    id: newId,
                                    type: 'mindMap',
                                    position: { x, y },
                                    data: { label: action.label || 'New Node', onLabelChange, color: '#ffffff' },
                                    style: { background: 'transparent', border: 'none' }
                                };

                                let sourceHandle = 'right';
                                let targetHandle = 'left';

                                if (dir === 'left') { sourceHandle = 'left'; targetHandle = 'right'; }
                                if (dir === 'bottom') { sourceHandle = 'bottom'; targetHandle = 'top'; }
                                if (dir === 'top') { sourceHandle = 'top'; targetHandle = 'bottom'; }

                                const newEdge: Edge = {
                                    id: `e-${action.parentId}-${newId}`,
                                    source: action.parentId,
                                    target: newId,
                                    sourceHandle,
                                    targetHandle
                                };

                                setNodes(nds => [...nds, newNode]);
                                setEdges(eds => [...eds, newEdge]);
                            }
                        }
                    }
                });
            }

            // 4. Update Chat History
            setNodeChats(prev => ({
                ...prev,
                [nodeId]: [...prev[nodeId], { role: 'model', content: finalReply }]
            }));

        } catch (e) {
            console.error("Node chat error", e);
            setNodeChats(prev => ({
                ...prev,
                [nodeId]: [...prev[nodeId], { role: 'model', content: "Sorry, I encountered an error processing your request." }]
            }));
        } finally {
            setIsLoading(false);
        }
    };

    if (view === 'map') {
        return (
            <div className="flex flex-col h-full bg-background border-l border-border/50">
                <div className="h-16 px-6 border-b border-border/50 flex items-center justify-between">
                    <div className="flex flex-col">
                        <h2 className="font-semibold text-lg flex items-center gap-2">
                            <MapIcon size={18} /> System Map Interact
                        </h2>
                        <span className="text-xs text-muted-foreground">Edit & Organize</span>
                    </div>
                    {onSave && (
                        <button
                            onClick={() => onSave({ nodes, edges })}
                            className="px-3 py-1.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                        >
                            <MapIcon size={14} /> Save Map
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-hidden relative bg-neutral-100 dark:bg-neutral-900/50">
                    <EditableMindMap
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={handleNodeClick}
                        onNodeDoubleClick={handleNodeDoubleClick}
                        setNodes={setNodes}
                        setEdges={setEdges}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-background border-l border-border/50">
            <div className="h-16 px-6 md:px-8 border-b border-border/50 flex items-center gap-3">
                <button
                    onClick={() => setView('map')}
                    className="p-2 -ml-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <ArrowLeft size={18} />
                </button>
                <div className="flex flex-col">
                    <h2 className="font-semibold text-sm truncate max-w-[200px]">{activeNode?.label}</h2>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Node Chat
                    </span>
                </div>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col relative bg-neutral-50/50 dark:bg-neutral-900/20">
                <ChatInterface
                    messages={nodeChats[activeNode?.id || ''] || []}
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
};

export default SystemMapPanel;
