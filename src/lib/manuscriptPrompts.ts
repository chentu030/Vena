// Interface fallback or just use any to be safe
// import { ResearchArticle } from "@/context/AnalysisContext";

export const RESEARCH_PROPOSAL_STRUCTURE = [
    {
        id: 'background',
        sectionNumber: 1,
        title: '一、研究計畫之背景 (Background)',
        subsections: [
            '(1) 欲解決問題與研究原創性',
            '(2) 研究重要性與預期影響',
            '(3) 文獻評述'
        ]
    },
    {
        id: 'methodology',
        sectionNumber: 2,
        title: '二、研究方法、進行步驟及執行進度 (Methodology)',
        subsections: [
            '(1) 研究目的與議題設定',
            '(2) 研究架構、流程與步驟',
            '(3) 研究方法 (質性/量化/混合)',
            '(4) 預計可能遭遇之困難及解決途徑'
        ]
    },
    {
        id: 'outcomes',
        sectionNumber: 3,
        title: '三、預期完成之工作項目及成果 (Expected Outcomes)',
        subsections: [
            '(1) 預期完成之工作項目',
            '(2) 對於參與之工作人員，預期可獲之訓練',
            '(3) 預期完成之研究成果',
            '(4) 學術研究、國家發展及其他應用方面預期之貢獻'
        ]
    },
    {
        id: 'questionnaire',
        sectionNumber: 4,
        title: '四、問卷設計與訪談大綱 (Questionnaire Design)',
        subsections: [
            '(1) 問卷/訪談設計依據',
            '(2) 擬定題項與構面',
            '(3) 參考文獻對照'
        ]
    }
];

export const generateSectionPrompt = (sectionId: string, topic: string, papers: any[], sectionNumber: number = 1) => {
    const papersList = papers.map((p, i) => `[ID:${i + 1}] "${p.title}" by ${p.authors} (${p.year})\nAbstract: ${p.abstract}`).join('\n\n');

    let specificInstruction = "";

    switch (sectionId) {
        case 'background':
            specificInstruction = `
            請以【學術審查專家】的角度，撰寫一份極具深度的【研究計畫之背景】。
            目標字數：請盡量詳實，力求內容豐富（此章節建議 1500 字以上）。
            
            詳細要求：
            1. **欲解決問題與研究原創性**：
               - 明確指出目前文獻中的【研究缺口 (Research Gap)】。
               - 強調本研究如何填補此缺口，並提出具原創性的論點。
            2. **研究重要性與預期影響**：
               - 從學術理論貢獻與實務管理意涵兩個層面進行闡述。
            3. **文獻評述 (Literature Review)**：
               - 請根據提供的參考文獻進行【綜合性評述 (Synthesis)】，而非條列式摘要。
               - 分析不同學者間的觀點差異與共通點。
               - 嚴格標註引用來源 [ID:X]。
            `;
            break;

        case 'methodology':
            specificInstruction = `
            請以【學術審查專家】的角度，撰寫一份嚴謹的【研究方法、進行步驟及執行進度】。
            目標字數：請盡量詳實，務必具體可行（此章節建議 1500 字以上）。
            
            詳細要求：
            1. **研究目的與議題設定**：
               - 列出具體的研究問題 (Research Questions)。
            2. **研究架構、流程與步驟**：
               - 描述概念性架構 (Conceptual Framework)。
               - 說明研究流程的邏輯性。
               - **請以文字詳細描述研究架構**，包括各階段之間的關係與順序（系統將自動生成視覺化流程圖）。
            3. **研究方法**：
               - 若適用，請優先考慮【質性個案研究法 (Qualitative Case Study)】或【混合研究法】，並結合【主題分析法 (Thematic Analysis)】。
               - 詳細說明資料收集方式（如深度訪談、次級資料分析）與分析工具。
            4. **預計困難與解方**：
               - 誠實評估執行風險（如資料取得不易）並提出具體應對策略。
            `;
            break;

        case 'outcomes':
            specificInstruction = `
            請撰寫【預期完成之工作項目及成果】。
            
            詳細要求：
            1. **具體產出**：列出預計完成的期刊論文篇數、研討會場次或技術報告。
            2. **人才培育**：具體說明研究助理將學習到的分析技術（如 MAXQDA, NVivo, Python 等）與學術素養。
            3. **社會貢獻**：連結至國家發展政策（如 2050 淨零排放、ESG 永續發展等）或產業應用價值。
            `;
            break;

        case 'questionnaire':
            specificInstruction = `
            請根據上述文獻，擬定一份初步的【問卷設計或訪談大綱】。
            
            詳細要求：
            1. **設計依據**：說明每個構面是參考哪一篇文獻的觀點（請標註 [ID:X]）。
            2. **題項設計**：
               - 若為量化：請列出 3-5 個主要構面及對應的測量問項。
               - 若為質性：請列出 5-10 題深度訪談大綱。
            3. **關聯性分析**：解釋這些問題如何回答本研究的研究問題。
            `;
            break;
    }

    return `
    你是一個嚴格的學術文章審查專家及撰寫高手。你的任務是根據以下提供的參考文獻，撰寫一份高品質、深度達到博士論文等級的研究計畫書章節。

    研究主題：${topic}
    撰寫章節：${sectionId}
    **當前章節編號：第 ${sectionNumber} 章**

    【參考文獻庫】
    ${papersList}

    【撰寫詳細指令】
    ${specificInstruction}

    【嚴格格式規範】
    1. **標題格式**：**絕對不要**自行產生章節大標題（如「第X章」、「一、」、「二、」等）。系統會自動加上章節標題。你只需要輸出該章節的「內容」。
    2. **子標題格式**：這是**第 ${sectionNumber} 章**，所以子標題編號必須以 ${sectionNumber} 開頭。例如：## ${sectionNumber}.1 子標題一、## ${sectionNumber}.2 子標題二、## ${sectionNumber}.3 子標題三...依此類推，編號要連續不可跳號。
    3. **引用格式**：在文中必須使用 [X] 標註引用來源。例如：\"根據 Porter 的觀點 [1]...\" 或多篇引用 \"[1, 3]\"。請勿使用 [ID:X]。
    4. **禁語**：**絕對不要**使用 [cite]、[citation] 或其他標記符號。
    5. **用詞風格**：使用極度專業、精確的學術口吻。避免使用 \"我認為\"、\"大概\"、\"可能\" 等模糊字眼。使用 \"本研究主張\"、\"文獻顯示\" 等客觀語句。
    6. **內容深度**：不要只產生大綱。我要的是**完整的段落內容**，要有起承轉合，論述要深入。
    7. **輸出格式**：僅輸出 Markdown 正文，不要有 \"好的，這是您的...\" 等聊天語句。直接從內容開始。

    請開始深入撰寫（記得：子標題編號以 ${sectionNumber}.X 開頭，不要自行加章節大標題）。
    `;
};

/**
 * Generate a dedicated Mermaid diagram prompt for Research Framework/Flowchart
 */
export const generateMermaidPrompt = (topic: string, methodologyContent: string) => {
    return `
    你是一個專業的學術視覺化設計師。根據以下研究主題與研究方法內容，請設計一張清晰、專業的 Mermaid 流程圖或架構圖。

    研究主題：${topic}
    
    研究方法內容摘要：
    ${methodologyContent.substring(0, 2000)}

    【設計要求】
    1. **圖表類型**：請根據內容選擇最適合的類型：
       - \`flowchart TD\` (由上至下的流程圖) - 適合研究流程
       - \`flowchart LR\` (由左至右的流程圖) - 適合線性流程
       - \`graph TD\` - 適合概念架構圖
    
    2. **節點設計**：
       - 使用方括號 \`[文字]\` 表示一般步驟
       - 使用圓括號 \`(文字)\` 表示起點/終點
       - 使用菱形 \`{文字}\` 表示決策點
       - 使用雙括號 \`[[文字]]\` 表示子程序
    
    3. **連結設計**：
       - 使用箭頭 \`-->\` 表示流程
       - 可加上說明文字 \`-->|說明|\`
    
    4. **結構要求**：
       - 包含 3-6 個主要階段
       - 每個階段可有 2-4 個子步驟
       - 確保邏輯清晰、視覺平衡

    【輸出格式】
    請僅輸出有效的 Mermaid 語法，以 \`\`\`mermaid 開頭，以 \`\`\` 結尾。不要有任何其他說明文字。

    範例格式：
    \`\`\`mermaid
    flowchart TD
        A[研究設計] --> B[資料蒐集]
        B --> C{資料類型}
        C -->|質性| D[深度訪談]
        C -->|量化| E[問卷調查]
        D --> F[主題分析]
        E --> G[統計分析]
        F --> H[研究發現]
        G --> H
    \`\`\`

    請開始設計。
    `;
};
