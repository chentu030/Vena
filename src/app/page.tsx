'use client';

import React, { useState, useEffect, useRef } from 'react';
import ChatInterface, { Message } from '@/components/ChatInterface';
import ArticleList from '@/components/ArticleList';
import PaperWriter from '@/components/PaperWriter';
import MindMap from '@/components/MindMap';
import SystemMapPanel from '@/components/SystemMapPanel';
import HistorySidebar from '@/components/HistorySidebar';
import MainEditor from '@/components/MainEditor';
import ResearchPanel from '@/components/ResearchPanel';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { Loader2, Moon, Sun, SidebarClose, SidebarOpen, Command, FileText, Map as MapIcon, X, BookOpen, Search as SearchIcon } from 'lucide-react';
import { saveDocument, loadCollection, deleteDocument, CollectionName, saveProjectData, loadProjectData } from '@/lib/firestore';

export default function Home() {
    const { user, loading, signOut } = useAuth();
    const router = useRouter();
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);


    const [mounted, setMounted] = useState(false);

    // Core State
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // History / Saved Items
    const [savedDrafts, setSavedDrafts] = useState<any[]>([]);
    const [savedMaps, setSavedMaps] = useState<any[]>([]);
    const [savedChats, setSavedChats] = useState<any[]>([]);
    const [savedManuscripts, setSavedManuscripts] = useState<any[]>([]);
    const [savedResearch, setSavedResearch] = useState<any[]>([]);

    // Current Active IDs
    const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
    const [currentMapId, setCurrentMapId] = useState<string | null>(null);
    const [currentChatsId, setCurrentChatsId] = useState<string | null>(null);
    const [currentManuscriptId, setCurrentManuscriptId] = useState<string | null>(null);
    const [currentResearchId, setCurrentResearchId] = useState<string | null>(null);
    const [currentResearchResults, setCurrentResearchResults] = useState<any[]>([]);

    // Research Groups
    const [researchGroups, setResearchGroups] = useState<any[]>([]);
    const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

    // Features State
    const [articles, setArticles] = useState<any[]>([]);
    const [mindMapCode, setMindMapCode] = useState<any>(null);
    const [paperContent, setPaperContent] = useState('');
    const [mainContent, setMainContent] = useState('');
    const [activeNodeChats, setActiveNodeChats] = useState<any>(null); // For mind map node chats
    const [historyOpen, setHistoryOpen] = useState(false);

    // Sidebar State: 'none' | 'draft' | 'map' | 'main' | 'research'
    const [sidebarView, setSidebarView] = useState<'none' | 'draft' | 'map' | 'main' | 'research'>('none');

    // Resizable sidebar width (percentage)
    const [sidebarWidth, setSidebarWidth] = useState(45);
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    // Initial Load - From Firestore
    useEffect(() => {
        const loadAll = async () => {
            if (!user) return;
            try {
                const [drafts, maps, chats, manuscripts, research, groups] = await Promise.all([
                    loadCollection(user.uid, 'drafts'),
                    loadCollection(user.uid, 'maps'),
                    loadCollection(user.uid, 'chats'),
                    loadCollection(user.uid, 'manuscripts'),
                    loadCollection(user.uid, 'research'),
                    loadCollection(user.uid, 'researchGroups')
                ]);
                setSavedDrafts(drafts);
                setSavedMaps(maps);
                setSavedChats(chats);
                setSavedManuscripts(manuscripts);
                setSavedResearch(research);
                setResearchGroups(groups);

                // Auto-select first group if exists
                if (groups.length > 0) {
                    setCurrentGroupId(groups[0].id);
                    setCurrentResearchResults((groups[0] as any).papers || []);
                }

                // Load current project data (single Map and Chat)
                const [currentMap, currentChat] = await Promise.all([
                    loadProjectData(user.uid, 'currentMap'),
                    loadProjectData(user.uid, 'currentChat')
                ]);
                if (currentMap && currentMap.data) {
                    setMindMapCode(currentMap.data);
                }
                if (currentChat && currentChat.messages) {
                    setMessages(currentChat.messages);
                }

                // Restore last active Manuscript
                if (manuscripts.length > 0) {
                    // Sort by updatedAt desc to get the latest
                    const sorted = [...manuscripts].sort((a: any, b: any) =>
                        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
                    ) as any[];

                    const latest = sorted[0];
                    if (latest) {
                        setCurrentManuscriptId(latest.id);
                        setMainContent(latest.content || '');
                        console.log("Restored latest manuscript:", latest.title);
                    }
                }
            } catch (e) {
                console.error("Failed to load history", e);
            }
        };
        if (user) loadAll();
        if (user) loadAll();
    }, [user]);

    // Auto-save Main Content (Manuscript)
    const lastSaveRef = useRef<number>(Date.now());
    const isFirstLoadRef = useRef(true);

    useEffect(() => {
        if (!user || !mainContent) return;

        // Skip save on initial mount/content load to prevent overwrites or empty saves
        if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
            // If we have content, syncing the ref time is good
            return;
        }

        const performSave = async () => {
            const docId = currentManuscriptId || `manuscript_${Date.now()}`;
            const title = currentManuscriptId
                ? savedManuscripts.find(m => m.id === currentManuscriptId)?.title
                : `Literature Review ${new Date().toLocaleDateString()}`;

            if (!currentManuscriptId) setCurrentManuscriptId(docId);

            try {
                await saveDocument(user.uid, 'manuscripts', {
                    id: docId,
                    title: title || 'Untitled Manuscript',
                    content: mainContent,
                    updatedAt: new Date().toISOString()
                });
                console.log("Manuscript auto-saved (60s/10s rule)");
                lastSaveRef.current = Date.now();
            } catch (e) {
                console.error("Auto-save failed", e);
            }
        };

        const now = Date.now();
        // Rule 1: Continuous usage -> Save every 60s
        if (now - lastSaveRef.current > 60000) {
            performSave();
            return; // Executed immediate save, no need for debounce
        }

        // Rule 2: Idle -> Save after 10s of no changes
        const timer = setTimeout(performSave, 10000);

        return () => clearTimeout(timer); // Reset timer on typing
    }, [mainContent, user, currentManuscriptId, savedManuscripts]);

    const handleSendMessage = async (text: string, model: string = 'gemini-2.5-flash', fileContent?: string, fileName?: string, referencedGroups?: string[]) => {
        // Build display message
        let displayText = text;
        if (fileName) {
            displayText = `📎 ${fileName}\n${text}`;
        }
        // If groups are referenced, handle them in display text
        if (referencedGroups && referencedGroups.length > 0) {
            const groupNames = referencedGroups.map(gid => researchGroups.find(g => g.id === gid)?.name).filter(Boolean).join(', ');
            displayText = `[Ref Group: ${groupNames}] ${text}`;
        }

        const newMessages = [...messages, { role: 'user', content: displayText } as Message];
        setMessages(newMessages);
        setIsLoading(true);

        try {
            // Priority: Check for Group Reference + Request
            if (referencedGroups && referencedGroups.length > 0) {
                // 1. Gather all papers with index numbers
                const targetPapers = referencedGroups.flatMap(gid => {
                    const group = researchGroups.find(g => g.id === gid);
                    return group?.papers || [];
                });

                if (targetPapers.length === 0) {
                    setMessages(prev => [...prev, { role: 'model', content: "Selected groups contain no papers." }]);
                    setIsLoading(false);
                    return;
                }

                // Check for Manuscript Generation Request
                if (text.includes("撰寫研究方法與理論架構文章") || text.includes("Draft Research Methods") || text.includes("Research Methods")) {
                    newMessages.push({ role: 'system', content: `📝 Drafting Research Methods & Theory article with Gemini 3.0 Pro...` });
                    setMessages([...newMessages]);

                    const papersText = targetPapers.map((p: any, i) => `[ID:${i + 1}] ${p.title}\nAbstract: ${p.abstract}\nMethodology: ${p.methodology || 'N/A'}`).join('\n\n');

                    // Limit papers context to avoid context window issues (though 3 Pro is large context)
                    // 15 papers * 500 words ~ 7.5k tokens. Should be fine.

                    const prompt = `Based on the following ${targetPapers.length} research papers, please write a comprehensive academic article section focusing on "Research Methods, Theoretical Framework, and Theoretical Models".

                    Papers:
                    ${papersText}

                    Requirements:
                    1. Language: Traditional Chinese (繁體中文).
                    2. Structure (organize logically):
                       - Introduction to the Research Approach (研究取徑)
                       - Theoretical Framework (理論架構)
                       - Theoretical Models (理論模型)
                       - Research Methods detail (研究方法細節)
                       - Synthesis/Conclusion (綜整)
                    3. The content must be highly detailed, professional, and synthesized. Do not just list the papers one by one; synthesize their commonalities and differences.
                    4. Cite sources using the format [ID] or (Author, Year).
                    5. Format as clean Markdown (headings, lists, bold text).

                    User specific instruction: "${text}"
                    `;

                    try {
                        const res = await fetch('/api/gemini', {
                            method: 'POST',
                            body: JSON.stringify({
                                model: 'gemini-3-pro-preview', // Explicitly requested by user
                                task: 'summary',
                                prompt: prompt,
                                history: []
                            })
                        });

                        if (!res.ok) throw new Error("Gemini API failed");

                        const data = await res.json();
                        let articleContent = data.text || '';

                        if (!articleContent && data.error) throw new Error(data.details || data.error);

                        // Process citations: Convert [ID:X] to <citation> tags
                        articleContent = articleContent.replace(/\[ID:(\d+)\]/g, (match: string, idStr: string) => {
                            const idx = parseInt(idStr) - 1;
                            if (idx >= 0 && idx < targetPapers.length) {
                                const p = targetPapers[idx];
                                const safeTitle = (p.title || '').replace(/"/g, '&quot;');
                                const doi = p.doi || '';
                                return `<citation index="${idStr}" title="${safeTitle}" doi="${doi}"></citation>`;
                            }
                            return match;
                        });

                        // Append to Main Content (Manuscript)
                        const currentContent = mainContent || '';
                        const divider = currentContent ? "\n\n---\n\n" : "";
                        const newContent = currentContent + divider + "# 整理：研究方法與理論架構\n\n" + articleContent;

                        setMainContent(newContent);

                        // Save to Firebase
                        const docId = currentManuscriptId || `manuscript_${Date.now()}`;
                        const title = currentManuscriptId
                            ? savedManuscripts.find(m => m.id === currentManuscriptId)?.title
                            : `Literature Review ${new Date().toLocaleDateString()}`;

                        await saveDocument(user!.uid, 'manuscripts', {
                            id: docId,
                            title: title || 'Untitled Manuscript',
                            content: newContent,
                            updatedAt: new Date().toISOString()
                        });

                        // If it was a new manuscript, update state
                        if (!currentManuscriptId) {
                            setCurrentManuscriptId(docId);
                            // Reload to sync sidebar
                            const manuscripts = await loadCollection(user!.uid, 'manuscripts');
                            setSavedManuscripts(manuscripts);
                        }

                        setSidebarView('main');
                        setMessages(prev => [...prev, { role: 'model', content: "✅ 已將「研究方法與理論架構」文章撰寫完成並追加至 Manuscript！" }]);

                    } catch (e) {
                        console.error("Drafting failed", e);
                        setMessages(prev => [...prev, { role: 'model', content: "❌ 撰寫失敗，請稍後再試。" }]);
                    }

                    setIsLoading(false);
                    return; // Stop here, do not proceed to Mind Map generation
                }

                newMessages.push({ role: 'system', content: `⚡ Starting 2-Phase Mind Map Generation for ${targetPapers.length} papers...` });
                setMessages([...newMessages]);

                // Determine categorization criteria from user input
                const userRequestLower = text.toLowerCase();
                let categorizationCriteria = "Research Methodologies or Key Themes";
                if (!userRequestLower.includes("請為選定的資料庫建立心智圖") && !userRequestLower.includes("mind map")) {
                    // If user typed something specific, try to use it as criteria
                    categorizationCriteria = text;
                }

                // Refine criteria string
                const criteriaPrompt = `Distinct Categories based on: "${categorizationCriteria}"`;

                newMessages.push({ role: 'system', content: `Phase 1: Analyzing ${categorizationCriteria} (Hierarchical) (gemini-3-flash-preview)...` });
                setMessages([...newMessages]);

                const allPapersContext = targetPapers.map((p: any) => `Title: ${p.title}\nAbstract: ${p.abstract}`).join('\n---\n').substring(0, 100000);

                const phase1Prompt = `Analyze these ${targetPapers.length} research papers and identify the ${criteriaPrompt}.
                Structure them into a Hierarchical Taxonomy (Mind Map).
                
                Input Papers:
                ${allPapersContext}

                CRITICAL OUTPUT FORMAT:
                Return a strictly valid JSON object representing the tree structure.
                Each node must have "id" (unique string), "label", and optional "children" array.
                Example:
                {
                  "id": "root", "label": "Overview (${categorizationCriteria})", "children": [
                    { "id": "cat1", "label": "Category 1", "children": [ ... ] },
                    { "id": "cat2", "label": "Category 2", "children": [ ... ] }
                  ]
                }
                
                Rules:
                1. Root ID must be "root".
                2. IDs should be short and descriptive.
                3. Create 2-3 levels of depth max.
                4. Cover all papers.`;

                let hierarchyRoot: any = { id: 'root', label: '研究總覽', children: [] };
                let flatCategories: { id: string, label: string }[] = [];

                try {
                    const res1 = await fetch('/api/gemini', {
                        method: 'POST',
                        body: JSON.stringify({
                            model: 'gemini-3-flash-preview',
                            task: 'summary',
                            prompt: phase1Prompt
                        })
                    });
                    const data1 = await res1.json();
                    if (!data1.text) throw new Error(data1.details || "No text returned from Gemini");
                    const jsonStr = (data1.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
                    hierarchyRoot = JSON.parse(jsonStr);

                    // Fallback if root is missing or wrong format
                    if (!hierarchyRoot.id) hierarchyRoot = { id: 'root', label: '研究總覽', children: Array.isArray(hierarchyRoot) ? hierarchyRoot : [] };

                    // Flatten for Phase 2 logic (we need a list of ALL candidate target nodes)
                    const traverse = (node: any) => {
                        flatCategories.push({ id: node.id, label: node.label });
                        if (node.children) node.children.forEach(traverse);
                    };
                    traverse(hierarchyRoot);

                } catch (e) {
                    console.error("Phase 1 Failed", e);
                    // Fallback
                    hierarchyRoot = {
                        id: 'root', label: '研究總覽',
                        children: [
                            { id: 'cat_a', label: 'Category A' },
                            { id: 'cat_b', label: 'Category B' }
                        ]
                    };
                    flatCategories = [{ id: 'root', label: 'Root' }, { id: 'cat_a', label: 'Category A' }, { id: 'cat_b', label: 'Category B' }];
                }

                // Phase 2: Assign Papers to Categories (Chunked)
                newMessages.push({ role: 'system', content: `Phase 2: Assigning papers to ${flatCategories.length} categories...` });
                setMessages([...newMessages]);

                const chunkSize = 15;
                const chunks = [];
                for (let i = 0; i < targetPapers.length; i += chunkSize) {
                    chunks.push(targetPapers.slice(i, i + chunkSize));
                }

                const assignments: { paperIndex: number, targetNodeId: string }[] = [];

                // Process chunks sequentially or parallel (sequential safer for rate limits?)
                // User said "Then repeat until all...". We can do parallel if API allows.
                await Promise.all(chunks.map(async (chunk, chunkIdx) => {
                    const chunkPrompt = `Classify these 15 papers into the provided Taxonomy based on "${categorizationCriteria}".
                    
                    Taxonomy Nodes (ID: Label):
                    ${flatCategories.map(c => `${c.id}: ${c.label}`).join('\n')}

                    Papers:
                    ${chunk.map((p: any, idx) => `[ID:${chunkIdx * chunkSize + idx}] ${p.title} (${p.abstract?.substring(0, 100)}...)`).join('\n')}

                    Task:
                    For each paper, find the MOST SPECIFIC node ID in the taxonomy to attach it to.
                    
                    Return JSON: [{"id": 0, "targetNodeId": "cat1"}, ...] (Use the Paper ID provided)
                    If unsure, use "root".`;

                    try {
                        const res2 = await fetch('/api/gemini', {
                            method: 'POST',
                            body: JSON.stringify({
                                model: 'gemini-3-flash-preview',
                                task: 'summary',
                                prompt: chunkPrompt
                            })
                        });
                        const data2 = await res2.json();
                        const jsonStr = data2.text.replace(/```json/g, '').replace(/```/g, '').trim();
                        const chunkAssignments = JSON.parse(jsonStr);
                        if (Array.isArray(chunkAssignments)) {
                            chunkAssignments.forEach((a: any) => {
                                assignments.push({ paperIndex: a.id, targetNodeId: a.targetNodeId });
                            });
                        }
                    } catch (e) {
                        console.error(`Phase 2 Chunk ${chunkIdx} failed`, e);
                    }
                }));

                // 3. Construct Node Structure Programmatically

                // Prefix for this batch to allow multiple trees in one map
                const idPrefix = `batch_${Date.now()}_`;
                const nodes: any[] = [];

                // Helper to convert Hierarchy to Nodes
                const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
                let colorIdx = 0;

                const processHierarchy = (node: any, parentId: string | null, depth: number) => {
                    // Unique ID for this run
                    const uniqueId = idPrefix + node.id;
                    const uniqueParent = parentId ? (idPrefix + parentId) : null;

                    // Assign color only to top-level branches (depth 1)
                    let color = '#3b82f6'; // root color
                    if (depth === 1) {
                        color = colors[colorIdx % colors.length];
                        colorIdx++;
                    } else if (depth > 1) {
                        color = '#64748b'; // Leaf nodes greyish
                    }

                    nodes.push({
                        // NO, autoLayout needs to output final IDs. 
                        // Let's use unique IDs everywhere to avoid confusion.
                        // Actually, autoLayout logic below relies on `nodes` having `parent` prop.
                        // So we push uniqueID here.
                        id: uniqueId,
                        type: 'mindMap',
                        label: node.label,
                        color: node.id === 'root' ? '#3b82f6' : (depth === 1 ? color : undefined),
                        parent: uniqueParent
                    });

                    // We need to pass original ID to children recursion? No, node.children are raw data.
                    if (node.children) {
                        node.children.forEach((child: any) => processHierarchy(child, node.id, depth + 1));
                    }
                };

                processHierarchy(hierarchyRoot, null, 0);

                // Paper Nodes
                assignments.forEach(assign => {
                    const paper = targetPapers[assign.paperIndex];
                    if (!paper) return;

                    // Verify target exists in original categories list (which has raw IDs), else fallback to root
                    const targetExists = flatCategories.some(c => c.id === assign.targetNodeId);
                    const rawTargetId = targetExists ? assign.targetNodeId : 'root';

                    // Construct unique parent ID
                    const finalParent = idPrefix + rawTargetId;

                    nodes.push({
                        id: `${idPrefix}p-${assign.paperIndex}`,
                        type: 'reference',
                        label: `[Paper] #${assign.paperIndex + 1} ${paper.title}`, // Standard Format
                        parent: finalParent,
                        data: {
                            referenceType: 'paper',
                            paperDoi: paper.doi,
                            paperAbstract: paper.abstract,
                            isCompact: false, // Show rich details by default
                            isCollapsed: true // For tree structure initially
                        }
                    });
                });

                // === REUSED AUTO LAYOUT ALGORITHM ===
                const autoLayout = (simpleNodes: any[]) => {
                    if (!simpleNodes || simpleNodes.length === 0) return { nodes: [], edges: [] };

                    const childrenMap: Record<string, string[]> = {};
                    const nodeMap: Record<string, any> = {};
                    let rootId = '';

                    simpleNodes.forEach(n => {
                        nodeMap[n.id] = n;
                        if (!n.parent) {
                            rootId = n.id;
                        } else {
                            if (!childrenMap[n.parent]) childrenMap[n.parent] = [];
                            childrenMap[n.parent].push(n.id);
                        }
                    });

                    if (!rootId && simpleNodes.length > 0) rootId = simpleNodes[0].id;

                    const HORIZONTAL_GAP = 350; // Increased ease spacing
                    const VERTICAL_SPACING = 40; // Spacing between nodes
                    const ROOT_X = 450;
                    const ROOT_Y = 350;

                    const heightMap: Record<string, number> = {};

                    // 1. Calculate Subtree Heights
                    const calculateHeight = (nodeId: string): number => {
                        const children = childrenMap[nodeId] || [];
                        const node = nodeMap[nodeId];
                        // Base height depends on node type
                        const baseHeight = node.type === 'reference' ? 140 : 60;

                        if (children.length === 0) {
                            heightMap[nodeId] = baseHeight;
                            return baseHeight;
                        }

                        let totalHeight = 0;
                        children.forEach(cid => {
                            totalHeight += calculateHeight(cid);
                        });
                        // Add spacing between children
                        totalHeight += (children.length - 1) * VERTICAL_SPACING;

                        // The height of this subtree is essentially the max of its content or its children span
                        // But for layout purposes, we care about the children span primarily
                        heightMap[nodeId] = Math.max(baseHeight, totalHeight);
                        return heightMap[nodeId];
                    };

                    calculateHeight(rootId);

                    const positions: Record<string, { x: number, y: number }> = {};

                    // 2. Layout Nodes
                    const layoutNode = (nodeId: string, x: number, y: number, direction: 'left' | 'right' | 'down') => {
                        positions[nodeId] = { x, y };
                        const children = childrenMap[nodeId] || [];
                        if (children.length === 0) return;

                        // Calculate starting Y for children block
                        // The parent is at Y. The children block should be centered at Y.
                        const totalChildrenHeight = heightMap[nodeId];
                        // Wait, heightMap[nodeId] includes the recursive height.
                        // We need the sum of children heights + gaps to determine the block start.

                        let currentY = y - (totalChildrenHeight / 2);

                        children.forEach((cid, idx) => {
                            const childH = heightMap[cid];
                            // Center the child in its allocated slot
                            const childCenterY = currentY + (childH / 2);

                            const childX = direction === 'left' ? x - HORIZONTAL_GAP :
                                direction === 'right' ? x + HORIZONTAL_GAP : x;

                            // For root, split children left/right
                            const childDirection = nodeId === rootId
                                ? (idx % 2 === 0 ? 'left' : 'right')
                                : direction;

                            // If we are root splitting, we need separate Y accumulators for left/right?
                            // Yes, simplified root logic here assumes all go one way or splits index based.
                            // If root splits, the calculation of total height above is wrong because it aggregates ALL children.
                            // For robustness, let's keep root logic simple: all right for mind map, or simple split.
                            // If splitting, we'd need to pre-calculate left-height and right-height separately.

                            // Let's stick to simple Right-direction flow for deep levels, 
                            // and for Root, let's just alternate Y but this is naive for height.
                            // FIX: To ensure no overlap, we should layout properly.

                            // BETTER APPROACH for Root:
                            // Split children into LeftGroup and RightGroup first.
                            // But for now, let's assume standard Mind Map: Right Flow mainly, or simple alternate.
                            // If alternating at root, we pass specific Ys.

                            // REFINED LOGIC: Recursive layout passes exact Y.
                            layoutNode(cid, childX, childCenterY, childDirection);

                            currentY += childH + VERTICAL_SPACING;
                        });
                    };

                    // Special handling for Root to support Left/Right balancing would require 2 passes.
                    // For now, to solve the overlap efficiently, let's force a Right-Heavy layout 
                    // or respect the simple logic but fix the height calc overlap.

                    // Let's force everything to the Right for simplicity and "List View" created by "Mind Map", 
                    // OR implement true split.
                    // True split is complex in one function. Let's do:
                    // Only Root uses special logic, children use `layoutNode`.

                    // Recalculate Root Split
                    const rootChildren = childrenMap[rootId] || [];
                    const leftChildren = rootChildren.filter((_, i) => i % 2 === 0);
                    const rightChildren = rootChildren.filter((_, i) => i % 2 !== 0);

                    // Calc heights for split
                    let leftTotalH = 0;
                    leftChildren.forEach(cid => { leftTotalH += heightMap[cid] + VERTICAL_SPACING; });

                    let rightTotalH = 0;
                    rightChildren.forEach(cid => { rightTotalH += heightMap[cid] + VERTICAL_SPACING; });

                    positions[rootId] = { x: ROOT_X, y: ROOT_Y };

                    // Layout Left
                    let leftY = ROOT_Y - (leftTotalH / 2) + (VERTICAL_SPACING / 2); // approximate center
                    leftChildren.forEach(cid => {
                        const h = heightMap[cid];
                        layoutNode(cid, ROOT_X - HORIZONTAL_GAP, leftY + (h / 2), 'left');
                        leftY += h + VERTICAL_SPACING;
                    });

                    // Layout Right
                    let rightY = ROOT_Y - (rightTotalH / 2) + (VERTICAL_SPACING / 2);
                    rightChildren.forEach(cid => {
                        const h = heightMap[cid];
                        layoutNode(cid, ROOT_X + HORIZONTAL_GAP, rightY + (h / 2), 'right');
                        rightY += h + VERTICAL_SPACING;
                    });


                    const finalNodes = simpleNodes.map(n => ({
                        id: n.id,
                        type: n.type || 'mindMap',
                        position: positions[n.id] || { x: 100, y: 100 },
                        data: {
                            label: n.label,
                            color: n.color,
                            referenceType: n.type === 'reference' ? 'paper' : undefined
                        }
                    }));

                    // ... Edges logic ...
                    const edges: any[] = [];
                    simpleNodes.forEach(n => {
                        if (n.parent && positions[n.id] && positions[n.parent]) {
                            const childPos = positions[n.id];
                            const parentPos = positions[n.parent];
                            let sourceHandle = 'bottom';
                            let targetHandle = 'top';

                            if (childPos.x < parentPos.x - 50) {
                                sourceHandle = 'left';
                                targetHandle = 'right';
                            } else if (childPos.x > parentPos.x + 50) {
                                sourceHandle = 'right';
                                targetHandle = 'left';
                            } else if (childPos.y < parentPos.y) {
                                sourceHandle = 'top';
                                targetHandle = 'bottom';
                            }

                            edges.push({
                                id: `e-${n.parent}-${n.id}`,
                                source: n.parent,
                                target: n.id,
                                sourceHandle,
                                targetHandle,
                                type: 'default',
                                animated: false
                            });
                        }
                    });

                    return { nodes: finalNodes, edges };
                };

                const layoutResult = autoLayout(nodes);

                if (layoutResult.nodes.length > 0) {
                    // Update map key to force reload in SystemMapPanel
                    setMapKey(Date.now().toString());

                    // Conflict Resolution: Append to existing map instead of overwriting
                    let finalNodes = layoutResult.nodes;
                    let finalEdges = layoutResult.edges;

                    try {
                        if (mindMapCode) {
                            const existingData = typeof mindMapCode === 'string' ? JSON.parse(mindMapCode) : mindMapCode;
                            if (existingData.nodes && existingData.nodes.length > 0) {
                                // Calculate offset to place new map to the right of existing map
                                const existingMaxX = Math.max(...existingData.nodes.map((n: any) => n.position.x));
                                const offsetX = existingMaxX + 1500; // 1500px gap

                                // Shift new nodes
                                finalNodes = finalNodes.map(n => ({
                                    ...n,
                                    position: {
                                        ...n.position,
                                        x: n.position.x + offsetX
                                    }
                                }));

                                // Merge
                                finalNodes = [...existingData.nodes, ...finalNodes];
                                finalEdges = [...existingData.edges, ...finalEdges];
                            }
                        }
                    } catch (e) {
                        console.error("Failed to merge with existing map", e);
                    }

                    setMindMapCode(JSON.stringify({ nodes: finalNodes, edges: finalEdges }));
                    setSidebarView('map');
                    setMessages(prev => [...prev, {
                        role: 'model',
                        content: `✅ Generated Mind Map with 2-Phase Analysis!\n\nOverview:\n- ${flatCategories.length} Categories Identified\n- ${targetPapers.length} Papers Classified`
                    }]);
                } else {
                    setMessages(prev => [...prev, { role: 'model', content: "Failed to generate map structure." }]);
                }

                setIsLoading(false);
                return; // End here for group processing
            }

            // Check if this is a literature search request
            const isLiteratureSearch = text.toLowerCase().includes('文獻') ||
                text.toLowerCase().includes('paper') ||
                text.toLowerCase().includes('literature') ||
                text.toLowerCase().includes('research on') ||
                (text.toLowerCase().includes('find') && (text.toLowerCase().includes('article') || text.toLowerCase().includes('study')));

            const isSearch = text.toLowerCase().startsWith('find') || text.toLowerCase().includes('search') || text.toLowerCase().includes('找') || isLiteratureSearch;
            let systemContext = '';

            // Add file content to context if provided
            let fileContext = '';
            if (fileContent) {
                // Truncate very large files to avoid token limits
                const truncatedContent = fileContent.length > 50000 ? fileContent.substring(0, 50000) + '\n\n[... content truncated due to length ...]' : fileContent;
                fileContext = `\n\n[UPLOADED FILE: ${fileName}]\n${truncatedContent}\n[END OF FILE]`;
            }

            if (isLiteratureSearch) {
                // Full hybrid search - put results in Research panel
                newMessages.push({ role: 'system', content: '🔍 Starting hybrid literature search (Scopus + Gemini)...' });
                setMessages([...newMessages]);

                // Helper: Generate PDF link
                const generatePdfLink = (title: string, doi: string) => {
                    if (doi) return `https://doi.org/${doi}`;
                    return `https://scholar.google.com/scholar?q=${encodeURIComponent(title)}`;
                };

                // Fetch from Scopus
                const fetchScopus = async (searchQuery: string, limit: number) => {
                    try {
                        const currentYear = new Date().getFullYear();
                        const dateFilter = `PUBYEAR > ${currentYear - 5} AND PUBYEAR < ${currentYear + 1}`;
                        // Use TITLE-ABS-KEY for better accuracy
                        const fullQuery = `TITLE-ABS-KEY(${searchQuery}) AND ${dateFilter}`;
                        const res = await fetch(`/api/scopus?q=${encodeURIComponent(fullQuery)}&count=${limit}`);
                        const data = await res.json();

                        if (data.error) {
                            console.error("Scopus API Error:", data.error, data.details);
                            return [];
                        }

                        const entries = data['search-results']?.['entry'] || [];
                        return entries.map((e: any) => ({
                            id: e['dc:identifier'] || `scopus-${Math.random()}`,
                            authors: e['dc:creator'] || 'Unknown',
                            title: e['dc:title'],
                            source: e['prism:publicationName'] || '',
                            year: e['prism:coverDate'] ? e['prism:coverDate'].substring(0, 4) : '',
                            pages: 'N/A',
                            doi: e['prism:doi'] || '',
                            link: generatePdfLink(e['dc:title'], e['prism:doi'] || ''),
                            keywords: '',
                            abstract: e['dc:description'] || '',
                            methodology: ''
                        }));
                    } catch (e) {
                        console.error("Scopus Error", e);
                        return [];
                    }
                };

                // Fetch from Gemini
                const fetchGemini = async (searchQuery: string, limit: number) => {
                    try {
                        const currentYear = new Date().getFullYear();
                        const prompt = `Generate a bibliography of exactly ${limit} recent academic papers (published between ${currentYear - 5} and ${currentYear}) related to: "${searchQuery}".
                        Strictly comply: 1. Output valid JSON with "articles" array. 2. Abstract in Traditional Chinese.
                        Format: { "articles": [{ "authors": "...", "title": "...", "source": "...", "year": "...", "abstract": "繁體中文摘要...", "doi": "..." }] }`;

                        const res = await fetch('/api/gemini', {
                            method: 'POST',
                            body: JSON.stringify({ model: 'gemini-3-pro-preview', prompt: prompt, history: [] })
                        });
                        const data = await res.json();
                        if (!data.text) throw new Error(data.details || "No text returned from Gemini");
                        const jsonStr = (data.text || '{}').replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(jsonStr);
                        return (parsed.articles || []).map((e: any, i: number) => ({
                            id: `gen-gemini-${i}-${Date.now()}`,
                            authors: e.authors || 'Unknown',
                            title: e.title,
                            source: e.source || 'Unknown Source',
                            year: e.year || 'N/A',
                            pages: 'N/A',
                            doi: e.doi || '',
                            link: generatePdfLink(e.title, e.doi || ''),
                            keywords: '',
                            abstract: e.abstract || '',
                            methodology: ''
                        }));
                    } catch (e) {
                        console.error("Gemini Search Error", e);
                        return [];
                    }
                };

                // Use AI to convert user's text into clean English search keywords
                const topicRes = await fetch('/api/gemini', {
                    method: 'POST',
                    body: JSON.stringify({
                        model: 'gemini-3-flash-preview',
                        task: 'summary',
                        prompt: `Convert the following user request into a single clean English search keyword phrase for academic literature search. Only output the keywords, nothing else. No quotes, no explanation.

User request: "${text}"

Examples:
- "找金融科技的論文" → fintech financial technology
- "我想研究機器學習在醫療的應用" → machine learning healthcare applications
- "關於ESG投資策略的文獻" → ESG investment strategy

Output only the keywords:`
                    })
                });
                const topicData = await topicRes.json();
                const searchTopic = topicData.text.trim().substring(0, 100);

                newMessages.push({ role: 'system', content: `📚 Searching for: "${searchTopic}"...` });
                setMessages([...newMessages]);

                // Parallel fetch
                const [scopusResults, geminiResults] = await Promise.all([
                    fetchScopus(searchTopic, 15),
                    fetchGemini(searchTopic, 15)
                ]);

                // Deduplicate and APPEND to existing results
                const combined: any[] = [];

                // Helper: Check if paper is duplicate
                const isDuplicate = (newPaper: any, existingList: any[]) => {
                    return existingList.some(existing => {
                        // If both have DOI, compare DOI (most reliable)
                        if (existing.doi && newPaper.doi && existing.doi === newPaper.doi) {
                            return true;
                        }
                        // Otherwise, compare normalized titles (exact match after cleanup)
                        const normalizeTitle = (t: string) => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        return normalizeTitle(existing.title) === normalizeTitle(newPaper.title);
                    });
                };

                // Start with existing papers
                currentResearchResults.forEach((existing: any) => {
                    combined.push(existing);
                });

                // Add new Scopus results (deduplicate)
                scopusResults.forEach((s: any) => {
                    if (!isDuplicate(s, combined)) combined.push(s);
                });

                // Add new Gemini results (deduplicate)
                geminiResults.forEach((g: any) => {
                    if (!isDuplicate(g, combined)) combined.push(g);
                });

                // Store in Research panel state
                setCurrentResearchResults(combined);
                // Keep current group ID if exists, don't reset

                newMessages.push({ role: 'system', content: `✅ Found ${combined.length} papers (${scopusResults.length} Scopus + ${geminiResults.length} Gemini). Organizing results...` });
                setMessages([...newMessages]);

                // Call Gemini to summarize and respond to user
                const summaryPrompt = `使用者問：「${text}」

我已從 Scopus 和 Gemini 找到 ${combined.length} 篇相關文獻。以下是前10篇的標題和摘要：

${combined.slice(0, 10).map((p: any, i: number) => `${i + 1}. 【${p.year}】${p.title}\n   作者: ${p.authors}\n   摘要: ${p.abstract?.substring(0, 150) || '無'}...`).join('\n\n')}

請用繁體中文回答使用者：
1. 簡要說明這個研究主題的概況
2. 歸納這些文獻的主要發現/趨勢
3. 提醒使用者可以在右側「Research」面板查看完整結果`;

                const summaryRes = await fetch('/api/gemini', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: model, task: 'chat', prompt: summaryPrompt, history: [] })
                });
                const summaryData = await summaryRes.json();

                // Add AI response with summary
                setMessages(prev => [...prev, { role: 'model', content: summaryData.text }]);
                setIsLoading(false);

                // Auto-open Research panel
                setSidebarView('research');

                // Skip the rest of the normal chat flow since we already responded
                return;

            } else if (isSearch) {
                // Step 1: Ask Gemini for 3 keywords - with stricter JSON enforcement
                const keywordRes = await fetch('/api/gemini', {
                    method: 'POST',
                    body: JSON.stringify({
                        model: model,
                        task: 'summary',
                        prompt: `You are a JSON generator. Extract 3 search keywords from: "${text}".
CRITICAL: Output ONLY this exact JSON format, no other text:
{"keywords": ["keyword1", "keyword2", "keyword3"]}
Do NOT include any explanation or markdown.`
                    })
                });
                const keywordData = await keywordRes.json();
                let keywords: string[] = [];
                try {
                    // Try to extract JSON from response
                    let jsonStr = keywordData.text || '';
                    // Remove markdown code blocks if present
                    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
                    // Try to find JSON object in the response
                    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const parsed = JSON.parse(jsonMatch[0]);
                        keywords = parsed.keywords || [];
                    }
                } catch (e) {
                    console.warn('Failed to parse keywords, using fallback extraction');
                    // Fallback: extract words from user query
                    keywords = text.replace(/find|search|找|文獻|paper|about|the|of|and|for/gi, '')
                        .split(/\s+/)
                        .filter(w => w.length > 2)
                        .slice(0, 3);
                }

                // Step 2: Search Scopus for each keyword (5 results each)
                let allResults: any[] = [];
                for (const keyword of keywords) {
                    try {
                        newMessages.push({ role: 'system', content: `Searching Scopus for: "${keyword}"...` });
                        // Update UI to show progress (optional, but good for UX)
                        setMessages([...newMessages]);

                        const scopusRes = await fetch(`/api/scopus?q=${encodeURIComponent(keyword)}&count=5`);
                        const scopusData = await scopusRes.json();

                        if (scopusData['search-results'] && scopusData['search-results']['entry']) {
                            allResults = [...allResults, ...scopusData['search-results']['entry']];
                        }
                    } catch (e) { console.error(`Search failed for ${keyword}`, e); }
                }

                // Deduplicate results by dc:identifier (Scopus ID) or doi
                const uniqueResults = Array.from(new Map(allResults.map(item => [item['dc:identifier'], item])).values());
                setArticles(uniqueResults);

                systemContext = `Found ${uniqueResults.length} articles based on keywords: ${keywords.join(', ')}. Articles: ${JSON.stringify(uniqueResults.map((r: any) => ({ title: r['dc:title'], abstract: r['dc:description']?.substring(0, 200) })))}`;
                newMessages.push({ role: 'system', content: `Found ${uniqueResults.length} articles total.` });
            }

            const history = newMessages.map(m => ({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.content }] }));
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: model, task: 'chat', history: history, prompt: text + fileContext + (systemContext ? `\n[System]: ${systemContext}` : '') })
            });
            const data = await response.json();
            setMessages(prev => [...prev, { role: 'model', content: data.text }]);

            if (text.toLowerCase().includes('mind map') || text.toLowerCase().includes('概念圖') || text.toLowerCase().includes('心智圖')) {
                const mmRes = await fetch('/api/gemini', {
                    method: 'POST',
                    body: JSON.stringify({
                        task: 'summary',
                        prompt: `Generate a Mind Map for: "${text}". Return ONLY valid JSON format for React Flow. 
                        Format: { 
                            "nodes": [
                                { "id": "1", "data": { "label": "Root Topic", "color": "#ffffff" }, "position": { "x": 250, "y": 0 }, "style": { "background": "transparent", "border": "none", "width": 150 } }
                            ], 
                            "edges": [] 
                        }. 
                        Create 5-10 nodes. Spread them out reasonably (x between 0-600, y between 0-600) so they don't overlap too much. Connect them logically.`
                    })
                });
                const mmData = await mmRes.json();
                try {
                    const code = mmData.text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsed = JSON.parse(code);

                    if (parsed.nodes && parsed.edges) {
                        setMindMapCode(JSON.stringify(parsed));
                        setSidebarView('map');
                    }
                } catch (e) { console.error("Failed to parse Mind Map JSON", e); }
            }
        } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };

    const handleAskAI = async (command: string, section: string) => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/gemini', {
                method: 'POST',
                body: JSON.stringify({ task: 'summary', prompt: command === 'structure' ? `Generate concise academic paper structure (Markdown).` : `Write content for section '${section}'. \nPaper:\n${paperContent}` })
            });
            const data = await res.json();
            setPaperContent(prev => prev + '\n' + data.text);
        } catch (e) { } finally { setIsLoading(false); }
    };




    // AI Title Generation
    const generateAiTitle = async (content: string, type: 'Draft' | 'Mind Map' | 'Chat') => {
        try {
            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: `Generate a very short, concise title (max 10 characters, Chinese or English) for this ${type}. \n\nContent:\n${content.substring(0, 500)}`,
                    systemInstruction: "You are a helpful assistant. Output ONLY the title, no quotes."
                })
            });
            const data = await response.json();
            return data.response.trim().substring(0, 15); // Safety clip
        } catch (e) {
            return null;
        }
    };

    // Rename Handler
    const handleRename = async (type: 'draft' | 'map' | 'chat' | 'manuscript' | 'research', id: string, newTitle: string) => {
        if (!user) return;

        const collectionMap: Record<string, CollectionName> = {
            'draft': 'drafts',
            'map': 'maps',
            'chat': 'chats',
            'manuscript': 'manuscripts',
            'research': 'research'
        };
        const collectionName = collectionMap[type];
        if (!collectionName) return;

        const updateList = (list: any[], setList: any, collection: CollectionName) => {
            const item = list.find(i => i.id === id);
            if (item) {
                const updatedItem = { ...item, title: newTitle, updatedAt: new Date().toISOString() };
                setList(list.map(i => i.id === id ? updatedItem : i));
                saveDocument(user.uid, collection, updatedItem);
            }
        };

        if (type === 'draft') updateList(savedDrafts, setSavedDrafts, 'drafts');
        if (type === 'map') updateList(savedMaps, setSavedMaps, 'maps');
        if (type === 'chat') updateList(savedChats, setSavedChats, 'chats');
        if (type === 'manuscript') updateList(savedManuscripts, setSavedManuscripts, 'manuscripts');
        if (type === 'research') updateList(savedResearch, setSavedResearch, 'research');
    };

    // Auto-save Chat Messages to Firebase
    useEffect(() => {
        if (!user || messages.length === 0) return;
        const timer = setTimeout(() => {
            // Sanitize messages to remove undefined values which Firestore hates
            const cleanMessages = JSON.parse(JSON.stringify(messages));
            saveProjectData(user.uid, 'currentChat', { messages: cleanMessages });
        }, 1000);
        return () => clearTimeout(timer);
    }, [messages, user]);

    // Auto-save Mind Map to Firebase
    useEffect(() => {
        if (!user || !mindMapCode) return;
        const timer = setTimeout(() => {
            // Sanitize to remove functions
            const sanitized = JSON.parse(JSON.stringify(mindMapCode, (key, value) =>
                typeof value === 'function' ? undefined : value
            ));
            saveProjectData(user.uid, 'currentMap', { data: sanitized });
        }, 1000);
        return () => clearTimeout(timer);
    }, [mindMapCode, user]);


    // New Draft Handler
    const handleNewDraft = () => {
        setCurrentDraftId(null);
        setPaperContent('');
        setSidebarView('draft');
    };

    const handleNewManuscript = () => {
        setCurrentManuscriptId(null);
        setMainContent('');
        setSidebarView('main');
    };

    // Auto-Save Draft
    useEffect(() => {
        if (!paperContent) return;

        const timer = setTimeout(async () => {
            const now = new Date();
            const newId = currentDraftId || now.getTime().toString();

            // Check if we need to generate a title (only for new drafts or untitled)
            let title = '';
            const existing = savedDrafts.find(d => d.id === newId);

            if (existing) {
                title = existing.title;
            } else {
                // New draft - try AI title
                const aiTitle = await generateAiTitle(paperContent, 'Draft');
                title = aiTitle || paperContent.split('\n')[0].substring(0, 10) || 'New Draft';
            }

            setSavedDrafts(prev => {
                const draftData = {
                    id: newId,
                    title,
                    content: paperContent,
                    createdAt: existing?.createdAt || now.toISOString(),
                    date: now.toISOString() // Last edited
                };

                const others = prev.filter(d => d.id !== newId);
                const updated = [draftData, ...others];

                if (user) saveDocument(user.uid, 'drafts', draftData);
                if (!currentDraftId) setCurrentDraftId(newId);

                return updated;
            });
        }, 2000);

        return () => clearTimeout(timer);
    }, [paperContent, currentDraftId, savedDrafts, user]);

    // Map Auto-Save Handler (called by SystemMapPanel)
    const handleAutoSaveMap = async (data: { nodes: any[], edges: any[] }) => {
        console.log('Auto-saving map...', data.nodes.length, 'nodes');
        const now = new Date();
        const newId = currentMapId || now.getTime().toString();

        let title = '';
        const existing = savedMaps.find(m => m.id === newId);

        if (existing) {
            title = existing.title;
        } else {
            // New map - generate title from nodes
            const content = data.nodes.map(n => n.data?.label || '').join(', ');
            // Don't await AI title to prevent blocking save
            generateAiTitle(content, 'Mind Map').then(t => {
                if (t && t !== title) {
                    // Update title later if needed
                }
            });
            title = `Map ${now.toLocaleDateString()}`;
        }

        // Sanitize nodes/edges to remove functions (Firestore can't store functions)
        const sanitizeForFirestore = (obj: any): any => {
            try {
                return JSON.parse(JSON.stringify(obj, (key, value) => {
                    if (typeof value === 'function') return undefined;
                    if (key.startsWith('__')) return undefined;
                    return value;
                }));
            } catch (e) {
                console.error('Sanitization failed:', e);
                return [];
            }
        };

        const newMap = {
            id: newId,
            title,
            nodes: sanitizeForFirestore(data.nodes),
            edges: sanitizeForFirestore(data.edges),
            createdAt: existing?.createdAt || now.toISOString(),
            date: now.toISOString()
        };

        setSavedMaps(prev => {
            const others = prev.filter(m => m.id !== newId);
            return [newMap, ...others];
        });

        if (user) {
            try {
                // Save to historical collection
                await saveDocument(user.uid, 'maps', newMap);
                console.log('Map saved to Firestore history:', newId);

                // CRITICAL: Also save as the CURRENT project map for persistence on refresh
                const sanitizedMap = sanitizeForFirestore(data);
                const jsonStr = JSON.stringify(sanitizedMap);
                await saveProjectData(user.uid, 'currentMap', {
                    data: jsonStr,
                    id: newId,
                    title: title
                });
                console.log('Map saved as current project data');

                // Update local state to ensure consistency if component remounts
                setMindMapCode(jsonStr);

            } catch (e) {
                console.error('Failed to save map to Firestore:', e);
            }
        }

        if (!currentMapId) setCurrentMapId(newId);
    };

    // Chat Auto-Save Handler
    const handleAutoSaveChats = async (chats: any) => {
        const now = new Date();
        const newId = currentChatsId || now.getTime().toString();

        let title = '';
        const existing = savedChats.find(c => c.id === newId);

        if (existing) {
            title = existing.title;
        } else {
            // New chat - generic title or extract from first message
            const content = JSON.stringify(chats).substring(0, 200);
            const aiTitle = await generateAiTitle(content, 'Chat');
            title = aiTitle || `Chat ${now.toLocaleDateString()}`;
        }

        setSavedChats(prev => {
            const newChats = {
                id: newId,
                title,
                chats,
                createdAt: existing?.createdAt || now.toISOString(),
                date: now.toISOString()
            };

            const others = prev.filter(c => c.id !== newId);
            const updated = [newChats, ...others];

            if (user) saveDocument(user.uid, 'chats', newChats);
            if (!currentChatsId) setCurrentChatsId(newId);

            return updated;
        });
    };

    // Auto-Save Manuscript
    useEffect(() => {
        if (!mainContent) return;

        const timer = setTimeout(async () => {
            const now = new Date();
            const newId = currentManuscriptId || now.getTime().toString();

            // Check if we need to generate a title (only for new items or untitled)
            let title = '';
            const existing = savedManuscripts.find(d => d.id === newId);

            if (existing) {
                title = existing.title;
            } else {
                // New manuscript - try AI title
                const aiTitle = await generateAiTitle(mainContent, 'Draft'); // Reusing Draft prompt type for similar content
                title = aiTitle || mainContent.split('\n')[0].substring(0, 10) || 'New Manuscript';
            }

            setSavedManuscripts(prev => {
                const manuscriptData = {
                    id: newId,
                    title,
                    content: mainContent,
                    createdAt: existing?.createdAt || now.toISOString(),
                    date: now.toISOString() // Last edited
                };

                const others = prev.filter(d => d.id !== newId);
                const updated = [manuscriptData, ...others];

                if (user) saveDocument(user.uid, 'manuscripts', manuscriptData);
                if (!currentManuscriptId) setCurrentManuscriptId(newId);

                return updated;
            });
        }, 2000);

        return () => clearTimeout(timer);
    }, [mainContent, currentManuscriptId, savedManuscripts, user]);


    const onLoadDraft = (id: string) => {
        const draft = savedDrafts.find(d => d.id === id);
        if (draft) {
            setPaperContent(draft.content);
            setCurrentDraftId(draft.id);
            setSidebarView('draft');
            setHistoryOpen(false);
        }
    };

    const onLoadMap = (id: string) => {
        const map = savedMaps.find(m => m.id === id);
        if (map) {
            setMindMapCode(JSON.stringify({ nodes: map.nodes, edges: map.edges }));
            setCurrentMapId(map.id);
            setMapKey(Date.now().toString());
            setSidebarView('map');
            setHistoryOpen(false);
        }
    };

    const onLoadChats = (id: string) => {
        const history = savedChats.find(c => c.id === id);
        if (history) {
            setActiveNodeChats(history.chats);
            setCurrentChatsId(history.id);
            setSidebarView('map');
            setHistoryOpen(false);
        }
    };

    const onLoadManuscript = (id: string) => {
        const m = savedManuscripts.find(d => d.id === id);
        if (m) {
            setMainContent(m.content);
            setCurrentManuscriptId(m.id);
            setSidebarView('main');
            setHistoryOpen(false);
        }
    };

    const onDeleteDraft = (id: string) => {
        const updated = savedDrafts.filter(d => d.id !== id);
        setSavedDrafts(updated);
        if (user) deleteDocument(user.uid, 'drafts', id);
        if (currentDraftId === id) {
            setCurrentDraftId(null);
            setPaperContent('');
        }
    };

    const onDeleteChats = (id: string) => {
        const updated = savedChats.filter(c => c.id !== id);
        setSavedChats(updated);
        if (user) deleteDocument(user.uid, 'chats', id);
        if (currentChatsId === id) {
            setCurrentChatsId(null);
            setActiveNodeChats(null);
        }
    };

    const onDeleteMap = (id: string) => {
        const updated = savedMaps.filter(m => m.id !== id);
        setSavedMaps(updated);
        if (user) deleteDocument(user.uid, 'maps', id);
        if (currentMapId === id) {
            setCurrentMapId(null);
            setMindMapCode(null);
        }
    };

    const onDeleteManuscript = (id: string) => {
        const updated = savedManuscripts.filter(m => m.id !== id);
        setSavedManuscripts(updated);
        if (user) deleteDocument(user.uid, 'manuscripts', id);
        if (currentManuscriptId === id) {
            setCurrentManuscriptId(null);
            setMainContent('');
        }
    };

    // Research Handlers
    const handleSaveResearch = (results: any[]) => {
        const now = new Date();
        const newId = currentResearchId || now.getTime().toString();
        const title = `Research ${now.toLocaleDateString()} (${results.length})`;

        setSavedResearch(prev => {
            const item = {
                id: newId,
                title,
                results,
                createdAt: now.toISOString(),
                date: now.toISOString()
            };
            const others = prev.filter(r => r.id !== newId);
            const updated = [item, ...others];
            if (user) saveDocument(user.uid, 'research', item);
            if (!currentResearchId) setCurrentResearchId(newId);
            return updated;
        });
    };

    const onLoadResearch = (id: string) => {
        const item = savedResearch.find(r => r.id === id);
        if (item) {
            setCurrentResearchResults(item.results);
            setCurrentResearchId(item.id);
            setSidebarView('research');
            setHistoryOpen(false);
        }
    };

    const onDeleteResearch = (id: string) => {
        const updated = savedResearch.filter(r => r.id !== id);
        setSavedResearch(updated);
        if (user) deleteDocument(user.uid, 'research', id);
        if (currentResearchId === id) {
            setCurrentResearchId(null);
            setCurrentResearchResults([]);
        }
    };

    // Research Group Handlers
    const handleCreateGroup = (name: string) => {
        if (!user) return;
        const newGroup = {
            id: `group-${Date.now()}`,
            name,
            papers: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        setResearchGroups(prev => [newGroup, ...prev]);
        setCurrentGroupId(newGroup.id);
        setCurrentResearchResults([]);
        saveDocument(user.uid, 'researchGroups', newGroup);
    };

    const handleGroupChange = (groupId: string) => {
        const group = researchGroups.find(g => g.id === groupId);
        if (group) {
            setCurrentGroupId(groupId);
            setCurrentResearchResults(group.papers || []);
        }
    };

    const handleGroupAutoSave = (papers: any[]) => {
        if (!user) return;

        // Sanitize papers to remove undefined values (Firestore doesn't accept undefined)
        const cleanPapers = papers.map(paper => {
            const cleaned: any = {};
            Object.keys(paper).forEach(key => {
                if (paper[key] !== undefined) {
                    cleaned[key] = paper[key];
                }
            });
            return cleaned;
        });

        // Auto-create default group if none exists
        if (!currentGroupId) {
            const newGroup = {
                id: `group-${Date.now()}`,
                name: 'Default Group',
                papers: cleanPapers,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            setResearchGroups(prev => [newGroup, ...prev]);
            setCurrentGroupId(newGroup.id);
            saveDocument(user.uid, 'researchGroups', newGroup);
            return;
        }

        setResearchGroups(prev => {
            const updated = prev.map(g =>
                g.id === currentGroupId
                    ? { ...g, papers: cleanPapers, updatedAt: new Date().toISOString() }
                    : g
            );
            // Save to Firebase
            const group = updated.find(g => g.id === currentGroupId);
            if (group) {
                saveDocument(user.uid, 'researchGroups', group);
            }
            return updated;
        });
    };


    // Memoize the parsed data to prevent SystemMapPanel from resetting on every render
    // This should ONLY re-parse when mindMapCode actually changes from external sources (load from Firebase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const parsedMindMapData = React.useMemo(() => {
        if (!mindMapCode) return null;
        try {
            return typeof mindMapCode === 'string' ? JSON.parse(mindMapCode) : mindMapCode;
        } catch (e) {
            console.error("Failed to parse mind map code", e);
            return null;
        }
    }, [mindMapCode]);

    // Use a map key to force reload in SystemMapPanel when generating/loading new maps
    const [mapKey, setMapKey] = useState<string>(() => currentMapId || `map-${Date.now()}`);

    if (loading || !user) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <Loader2 className="animate-spin text-blue-500" size={32} />
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-background text-foreground transition-colors duration-500 relative">

            {/* History Sidebar */}
            <HistorySidebar
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                savedDrafts={savedDrafts}
                savedMaps={savedMaps}
                savedChats={savedChats}
                savedManuscripts={savedManuscripts}
                onLoadDraft={onLoadDraft}
                onLoadMap={onLoadMap}
                onLoadChats={onLoadChats}
                onLoadManuscript={onLoadManuscript}
                onDeleteDraft={onDeleteDraft}
                onDeleteMap={onDeleteMap}
                onDeleteChats={onDeleteChats}
                onDeleteManuscript={onDeleteManuscript}
                savedResearch={savedResearch}
                onLoadResearch={onLoadResearch}
                onDeleteResearch={onDeleteResearch}
                onRename={handleRename}
                onNewDraft={handleNewDraft}
                onNewManuscript={handleNewManuscript}
            />

            {/* Toggle History Button */}
            <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className={`fixed top-1/2 right-0 transform -translate-y-1/2 z-[55] bg-white dark:bg-neutral-800 border border-border/50 p-2 rounded-l-xl shadow-lg transition-transform duration-300 ${historyOpen ? 'translate-x-full' : 'translate-x-0'}`}
            >
                <div className="writing-vertical-lr text-xs font-medium tracking-widest uppercase text-muted-foreground py-2 flex items-center gap-2">
                    <span className="rotate-180">History</span>
                </div>
            </button>


            {/* Search / Chat Area */}
            <div className={`flex-1 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${sidebarView !== 'none' ? `mr-[${sidebarWidth}%]` : ''} relative z-10`} style={sidebarView !== 'none' ? { marginRight: `${sidebarWidth}%` } : {}} onClick={() => sidebarView !== 'none' && setSidebarView(sidebarView)}>

                {/* Minimal Header with Glass Effect */}
                <header className="absolute top-0 left-0 right-0 h-20 px-8 flex justify-between items-center z-20 bg-white/70 dark:bg-black/70 backdrop-blur-xl border-b border-black/5 dark:border-white/5 transition-all duration-300">
                    <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center text-background shadow-sm">
                            <Command size={14} />
                        </div>
                        <span className={`font-medium tracking-tight mr-4 ${sidebarView !== 'none' ? 'hidden' : 'hidden md:block'}`}>Venalium</span>

                        {/* User Profile - Client Side Only to prevent hydration mismatch */}
                        {mounted && user && (
                            <div className="flex items-center gap-3 pl-4 border-l border-neutral-200 dark:border-neutral-800">
                                {user.photoURL ? (
                                    <img
                                        src={user.photoURL}
                                        alt="User"
                                        className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-700"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                                        {(user.email || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                                <div className={`hidden md:flex flex-col ${sidebarView !== 'none' ? 'hidden' : ''}`}>
                                    <span className="text-xs font-medium max-w-[100px] truncate">{user.displayName || 'User'}</span>
                                    <button onClick={() => signOut()} className="text-[10px] text-muted-foreground hover:text-red-500 text-left transition-colors">
                                        Sign out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800 p-1 rounded-full border border-black/5 dark:border-white/5">
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'draft' ? 'none' : 'draft'); }}
                            className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'draft' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Draft"
                        >
                            <FileText size={14} /> <span className={sidebarView !== 'none' ? 'hidden' : 'hidden sm:inline'}>Draft</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'map' ? 'none' : 'map'); }}
                            className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'map' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Mind Map"
                        >
                            <MapIcon size={14} /> <span className={sidebarView !== 'none' ? 'hidden' : 'hidden sm:inline'}>Map</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'main' ? 'none' : 'main'); }}
                            className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'main' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Manuscript"
                        >
                            <BookOpen size={14} /> <span className={sidebarView !== 'none' ? 'hidden' : 'hidden sm:inline'}>Manuscript</span>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setSidebarView(sidebarView === 'research' ? 'none' : 'research'); }}
                            className={`flex items-center gap-2 px-3 lg:px-4 py-1.5 rounded-full transition-all duration-300 text-sm font-medium ${sidebarView === 'research' ? 'bg-white dark:bg-black shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                            title="Research"
                        >
                            <SearchIcon size={14} /> <span className={sidebarView !== 'none' ? 'hidden' : 'hidden sm:inline'}>Research</span>
                        </button>
                    </div>
                </header>

                {/* Dynamic Content */}
                <main className="flex-1 flex flex-col overflow-y-auto w-full max-w-3xl mx-auto pt-24 px-6 pb-0 scrollbar-hide">
                    {/* Dynamic Greeting */}
                    {messages.length === 0 && (
                        <div className="min-h-[40vh] flex flex-col justify-end pb-8 animate-fade-in">
                            <h1 className="text-5xl md:text-6xl font-serif font-light tracking-tight mb-4 leading-[1.1]">
                                What shall we <br />
                                <span className="italic text-muted-foreground">research today?</span>
                            </h1>
                            <p className="text-lg text-muted-foreground font-light max-w-lg">
                                Powered by Gemini 3.0 & Scopus. Ask anything about academic papers.
                            </p>
                        </div>
                    )}

                    <ChatInterface
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        isLoading={isLoading}
                        articles={articles}
                        onAddToContext={(doc) => setMessages(prev => [...prev, { role: 'system', content: `Added: ${doc['dc:title']} to context.` }])}
                        researchGroups={researchGroups}
                        currentGroupId={currentGroupId}
                    />
                </main>

                {/* Theme Toggle Floating Bottom Left */}
                {mounted && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setTheme(theme === 'dark' ? 'light' : 'dark'); }}
                        className="absolute bottom-6 left-6 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/20 transition-all z-20"
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                )}
            </div>

            {/* Sidebar Container - Resizable */}
            <div
                style={{ width: `${sidebarWidth}%` }}
                className={`fixed inset-y-0 right-0 bg-background border-l border-border/50 shadow-2xl z-30 transform transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] glass-panel ${sidebarView !== 'none' ? 'translate-x-0' : 'translate-x-full'} ${isResizing ? 'transition-none' : ''}`}
            >
                {/* Resize Handle */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors z-50 group"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                        const startX = e.clientX;
                        const startWidth = sidebarWidth;
                        const handleMouseMove = (moveEvent: MouseEvent) => {
                            const delta = startX - moveEvent.clientX;
                            const newWidth = Math.min(80, Math.max(25, startWidth + (delta / window.innerWidth) * 100));
                            setSidebarWidth(newWidth);
                        };
                        const handleMouseUp = () => {
                            setIsResizing(false);
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                        };
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);
                    }}
                >
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 bg-neutral-300 dark:bg-neutral-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {sidebarView === 'draft' && (
                    <PaperWriter
                        content={paperContent}
                        setContent={setPaperContent}
                        onAskAI={handleAskAI}
                    />
                )}

                {sidebarView === 'map' && (
                    <SystemMapPanel
                        mindMapData={parsedMindMapData}
                        onSave={handleAutoSaveMap}
                        initialNodeChats={activeNodeChats}
                        onSaveChats={handleAutoSaveChats}
                        availableGroups={researchGroups}
                        mapKey={mapKey}
                    />
                )}

                {sidebarView === 'main' && (
                    <MainEditor
                        content={mainContent}
                        setContent={setMainContent}
                    />
                )}

                {sidebarView === 'research' && (
                    <ResearchPanel
                        key={currentGroupId || currentResearchId || 'new'}
                        onClose={() => setSidebarView('none')}
                        initialResults={currentResearchResults}
                        onSave={handleSaveResearch}
                        groups={researchGroups}
                        currentGroupId={currentGroupId}
                        onGroupChange={handleGroupChange}
                        onCreateGroup={handleCreateGroup}
                        onAutoSave={handleGroupAutoSave}
                    />
                )}

                {/* Close Button specifically for mobile or convenience */}
                {sidebarView !== 'none' && (
                    <button
                        onClick={() => setSidebarView('none')}
                        className="absolute top-6 right-6 p-2 text-muted-foreground hover:text-foreground z-50 md:hidden"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
        </div>
    );
}
