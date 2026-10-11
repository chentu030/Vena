# 醫院總額申報儀表板

純靜態網頁（HTML + CSS + JavaScript，無需安裝套件），透過 GitHub Pages 提供辦公室同仁瀏覽。

| 頁籤 | 內容 |
|---|---|
| 全國概況 | 點數／件數／點件 KPI、當年 vs 去年每月趨勢、各分區成長率、分區與層級明細表 |
| 各醫院 | 全國各醫院門住診點數、件數、點/件與成長，可依分區／層級／體系篩選、搜尋、排序、匯出 CSV |
| 北醫體系 | 北醫大體系合計，以及附醫、萬芳、雙和、新國民各院明細與趨勢圖 |

期間可選「單月」、「年累計」或「自訂區間」，多月時以月平均呈現，同期為去年相同月份。

## 每月更新資料

1. 取得最新的申報 Excel（格式同 `醫院申報資料_115.06.xlsx`）。
2. 在專案根目錄執行（需 Python 3 與 `openpyxl`：`pip install openpyxl`）：

   ```bash
   python3 dashboard/scripts/build_data.py 路徑/最新檔案.xlsx dashboard/data.json
   ```

3. 將 `dashboard/data.json` commit 並 push 到 `main`，GitHub Actions 會自動重新部署。

腳本讀取的工作表：

- `門診點數(不含交付)_113年1月升格`
- `門診件數(113年1月升格層級)`
- `住院點數(113年1月升格)`
- `住院件數(113年1月升格)`

> 注意：Excel 中「門診點數(含交付)」只更新到 112/12，因此儀表板的門診點數一律為**不含交付**。若之後提供含交付的最新資料，可在 `build_data.py` 的 `SHEETS` 中替換工作表名稱。

## 第一次啟用 GitHub Pages

1. 到 GitHub repo → **Settings → Pages**。
2. **Build and deployment → Source** 選 **GitHub Actions**。
3. 將含 `dashboard/` 的變更合併到 `main`（或在 Actions 頁手動執行 *Deploy dashboard to GitHub Pages*）。
4. 部署完成後網址為 `https://<帳號>.github.io/<repo>/`。

## 本機預覽

`data.json` 需經由 HTTP 讀取，不能直接雙擊 `index.html`：

```bash
cd dashboard && python3 -m http.server 8000
# 開啟 http://localhost:8000
```
