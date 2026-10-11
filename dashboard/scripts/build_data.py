"""將健保申報 Excel 轉成儀表板使用的 data.json。

用法：python3 dashboard/scripts/build_data.py <excel 檔> [輸出路徑]
"""
import json
import re
import sys
from datetime import datetime, timezone, timedelta

import openpyxl

SHEETS = {
    "op": "門診點數(不含交付)_113年1月升格",
    "oc": "門診件數(113年1月升格層級)",
    "ip": "住院點數(113年1月升格)",
    "ic": "住院件數(113年1月升格)",
}
START_YM = 10801  # 只輸出 108 年起的月資料
REGIONS = ["台北", "北區", "中區", "南區", "高屏", "東區"]
LEVELS = {"醫學中心": "醫中", "區域醫院": "區域", "地區醫院": "地區", "其他醫院": "其他"}


def month_cols(header):
    cols = {}
    for i, h in enumerate(header):
        s = str(h).strip() if h is not None else ""
        if re.fullmatch(r"1\d{4}", s):
            ym = int(s)
            if ym >= START_YM and 1 <= ym % 100 <= 12:
                cols[ym] = i
    return cols


def read_sheet(ws):
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    key_idx = header.index("參照用")
    name_idx = header.index("醫院別")
    cols = month_cols(header)
    out = {}
    for r in rows:
        if r[0] not in REGIONS or not r[key_idx]:
            continue
        vals = {}
        for ym, c in cols.items():
            v = r[c]
            vals[ym] = v if isinstance(v, (int, float)) else None
        out[r[key_idx]] = {
            "region": r[0], "level": r[1], "system": r[2], "name": r[name_idx], "vals": vals,
        }
    return out, sorted(cols)


def norm_system(s):
    if not s:
        return ""
    s = re.sub(r"\(備註\)$", "", str(s).strip())
    return s


def main():
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else "dashboard/data.json"
    wb = openpyxl.load_workbook(src, read_only=True, data_only=False)
    data, months = {}, None
    for k, name in SHEETS.items():
        data[k], m = read_sheet(wb[name])
        months = m if months is None else sorted(set(months) & set(m))

    # 只保留至少一個月有點數的月份（去掉尾端空欄）
    def has_any(ym):
        return any(h["vals"].get(ym) for h in data["op"].values())
    while months and not has_any(months[-1]):
        months.pop()

    base = data["op"]
    keys = list(base)
    for k in ("oc", "ip", "ic"):
        for key in data[k]:
            if key not in base:
                keys.append(key)

    hospitals = []
    for key in keys:
        meta = next(data[k][key] for k in SHEETS if key in data[k])
        system = norm_system(base[key]["system"]) if key in base else norm_system(meta["system"])
        series = {}
        total = 0
        for k in SHEETS:
            row = data[k].get(key)
            arr = [row["vals"].get(ym) if row else None for ym in months]
            arr = [round(v) if isinstance(v, float) else v for v in arr]
            series[k] = arr
            total += sum(v or 0 for v in arr)
        if total == 0:
            continue
        hospitals.append({
            "name": str(meta["name"]).strip(),
            "region": meta["region"],
            "level": LEVELS.get(meta["level"], "其他"),
            "system": system,
            **series,
        })

    tw = timezone(timedelta(hours=8))
    out = {
        "updated": datetime.now(tw).strftime("%Y/%m/%d %H:%M"),
        "source": src.split("/")[-1],
        "months": months,
        "regions": REGIONS,
        "levels": ["醫中", "區域", "地區", "其他"],
        "hospitals": hospitals,
    }
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote {dst}: {len(hospitals)} hospitals, months {months[0]}..{months[-1]}")


if __name__ == "__main__":
    main()
