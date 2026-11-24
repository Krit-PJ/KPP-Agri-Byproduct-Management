# ABM API 1.2.0 — ระบบบริหารจัดการวัสดุเหลือใช้ทางการเกษตร

Web App (`/exec`) ของโปรเจกต์ Apps Script **ABM — Agri By-product Management KPP API**

| ช่องทาง | ใช้โดย | หมายเหตุ |
| --- | --- | --- |
| `GET ?api=v1&endpoint=summary\|residue\|balance\|crop\|hit\|visits\|health` | Dashboard (`index.html`) | สาธารณะ ข้อมูลรวมเท่านั้น JSON หรือ JSONP (`&callback=`) · `GET` ไม่มีพารามิเตอร์ = health |
| `POST {method, args, token}` | หน้าเจ้าหน้าที่ (`admin.html`) | ตารางสิทธิ์ใน `Admin.gs` (`ADMIN_METHODS`) |

ไม่มี JSONP RPC ของตลาด (`?action=rpc`, `loginServer`, `registerServer`, `ssoLoginServer`, ...) — อยู่ที่ Green Gain Hub

## 1.2.0: ลงทะเบียนเจ้าหน้าที่ (ยืนยันเบอร์ + รออนุมัติ)

- `staffRegisterServer({ name, phone, officeType, district|group, province, ticket })` — `ticket` จากตัวตนกลาง (aud ABM) บังคับ เว้นแต่ `SSO_MODE=off` · ตอบ `{ status: 'pending', message }` (ไม่มี token)
- ข้อผิดพลาด `MARKET_ACCOUNT: …` = เกษตรกร/ผู้รับซื้อ (scope `market` หรือเบอร์ใน feed `marketPhones`) · `ssoStaffLoginServer` ตอบ `{ status: 'market_user', message }`
- บัญชี `pending` เข้าไม่ได้จนกว่า `adminSaveServer` (Mini/Super) ตั้ง `status: 'active'` (ไม่อนุมัติ = `disabled`)

## 1.1.0: ระยะเวลาแสดงแปลงบนตลาด Green Gain Hub

- RPC `gghMarketRuleServer()` / `gghMarketRuleSaveServer({hideAfterHarvestDays})` (Super/Mini) → POST `{action:'abm_config', key, hideAfterHarvestDays, by}` ไปที่ Green Gain Hub 2.8.0 · บันทึก `admin_log` action `ggh_market_rule`
- 1.3.0: RPC `reportDataServer({sections:['ggh.*'], gghProvince})` → POST `{action:'abm_report', key, province}` (Green Gain Hub 3.2.0; `gghProvince` ใช้ได้เฉพาะ Super Admin: `ALL` หรือรหัสจังหวัด 2 หลัก ผู้อื่นเป็น `62` เสมอ) · RPC `gghPinResetServer({phone})` (Super Admin) → POST `{action:'abm_pin_reset', key, phone, by}` · บันทึก `admin_log` action `ggh_pin_reset` (เบอร์ปิดบัง)
- `summary`: `totals.farmerPlots` = แปลงที่แสดงบนตลาด, `totals.hiddenPlots`, `listing: {hideAfterHarvestDays, startDate}`

## 1.0.0: แยกจาก Green Gain Hub

- `health` → `{ apiVersion: "1.2.0", feature: "ABM_SPLIT", system: "ABM" }`
- `summary.data.market` → `{ source: "Green Gain Hub", url, ok, stale, generatedAt, error }` บอกว่าตัวเลขตลาดมาจาก feed และเป็นปัจจุบันหรือไม่
  - `ok:false` = อ่าน Green Gain Hub ไม่ได้และไม่มีสำเนาล่าสุด (ตัวเลขตลาดเป็น 0)
  - `stale:true` = อ่านไม่ได้ ใช้สำเนาล่าสุดที่อ่านได้ (เก็บไม่เกิน 6 ชั่วโมง)
- Admin API ใหม่: `gghTestServer` (Mini/Super) ทดสอบ feed · `settingsGetServer` เพิ่ม `ggh { url, site, linked }`
- เจ้าหน้าที่เข้าสู่ระบบผ่านตัวตนกลางด้วยตั๋ว `aud: "ABM"` (`ssoStaffLoginServer`, `ssoProvisionServer`) — ต้องใช้ Agri-Risk 3.12.3 ขึ้นไป

## Feed จาก Green Gain Hub (Server ถึง Server)

ABM ส่ง `POST {action: "abm_feed", key}` ไปที่ Web App ของ Green Gain Hub (2.5.1 ขึ้นไป) → `{ ok, data: { apiVersion, generatedAt, farmers: {headers, rows}, buyers: {headers, rows} } }` แถวเรียงตามคอลัมน์ของชีต วันที่เป็น ISO

- กุญแจ: `gghLink_()` (ใน `setupSystem`) สร้างกุญแจสุ่ม 128 บิต เก็บใน Script Property `GGH_FEED_KEY` ของ ABM และเขียนเฉพาะ SHA-256 ลง `Config!abm_feed_key_sha256` ของฐานข้อมูล Green Gain Hub — ไม่มีใครต้องคัดลอกกุญแจ และกุญแจจริงไม่อยู่ในชีตใด รันซ้ำ = ใช้กุญแจเดิม ลบ Script Property แล้วรัน = เปลี่ยนกุญแจ
- Cache 5 นาที (`gghfeed:v1:fresh`) และสำเนาสำรอง 6 ชั่วโมง (`gghfeed:v1:stale`) ใช้เมื่อ Green Gain Hub ตอบไม่ได้
- ผู้รับซื้อที่เพิ่งลงทะเบียน: ถ้าเจ้าหน้าที่เลือกผู้รับซื้อที่ไม่อยู่ใน cache ระบบอ่าน feed ใหม่ 1 ครั้งก่อนแจ้งว่าไม่พบ
- Script Properties (ไม่บังคับ): `GGH_API_URL`, `GGH_SPREADSHEET_ID`

---

# Public API v1 (จาก Green Gain Hub 1.5.0)

URL เดียวกับ Web App (`/exec`) รองรับทั้ง `fetch` (JSON) และ JSONP (`&callback=`)

| Endpoint | ตัวอย่าง |
| --- | --- |
| สรุป Dashboard | `/exec?api=v1&endpoint=summary&key=YOUR_KEY` |
| ตรวจเวอร์ชัน | `/exec?api=v1&endpoint=health` |

`key` ไม่บังคับ ยกเว้นตั้ง Script Property `SUMMARY_API_KEY` ไว้ (คีย์ในหน้าเว็บสาธารณะมองเห็นได้ จึงใช้กันการนำไปใช้ซ้ำแบบง่ายเท่านั้น) เพิ่ม `&refresh=1` เพื่อข้าม cache

```json
{
  "ok": true, "api": "v1", "endpoint": "summary", "apiVersion": "1.5.0",
  "data": {
    "generatedAt": "...", "province": "กำแพงเพชร", "cacheSeconds": 300,
    "totals": { "farmerPlots": 16, "farmers": 7, "plotsWithCoordinates": 16, "areaRai": 284.31,
      "buyers": 9, "capacityTonPerDay": 250, "avgBuyerPriceBahtPerRai": 30,
      "potentialValueBaht": 7614, "residueTon": null, "districtsCovered": 3, "districtsTotal": 11 },
    "upcomingHarvest": { "days30": { "plots": 0, "areaRai": 0 }, "days60": { "plots": 0, "areaRai": 0 } },
    "byDistrict": [{ "code": "6204", "name": "ขาณุวรลักษบุรี", "plots": 9, "farmers": 3, "areaRai": 184.75,
      "buyers": 9, "capacityTonPerDay": 250, "residueTon": null, "materials": [{ "material": "ฟางข้าว", "areaRai": 154.25 }, { "material": "เหง้ามันสำปะหลัง", "areaRai": 30.5 }] }],
    "byMaterial": [{ "material": "ฟางข้าว", "plots": 15, "areaRai": 253.81, "buyers": 9, "capacityTonPerDay": 250,
      "avgBuyerPriceBahtPerRai": 30, "potentialValueBaht": 7614, "bioRateTonPerRai": null, "residueTon": null }],
    "byCrop": [{ "crop": "ข้าวนาปรัง", "material": "ฟางข้าว", "plots": 6, "areaRai": 129.81 }],
    "harvestByMonth": [{ "month": "2026-11", "plots": 0, "areaRai": 0, "isCurrent": true }],
    "goals": [], "notes": { "area": "...", "price": "...", "residue": "...", "privacy": "..." }
  }
}
```

กติกา: นับเฉพาะแปลง `Open` และผู้รับซื้อ `Active`; พื้นที่แปลงจาก `ไร่-งาน-ตร.ว.`; อำเภอคำนวณจากพิกัดด้วย `Districts.gs` (ไม่มีพิกัด/อยู่นอกจังหวัด → `OTHER`); `potentialValueBaht` = พื้นที่ × ราคาเฉลี่ยของผู้รับซื้อวัสดุชนิดเดียวกัน

## `data.reports` — KPP Smart Agri-Materials (เพิ่มใน summary)

Backend เรียก `…AKfycbxoo4…/exec?api=v1&endpoint=summary|districts|timeseries|meta&items=agri&key=…` ฝั่ง Server แล้วจัดรูปใหม่ (cache 5 นาที, ล้มเหลว cache 1 นาที)

```json
"reports": {
  "ok": true, "configured": true,
  "source": { "name": "KPP Smart Agri-Materials", "office": "...", "title": "...", "season": "2569 - 2570" },
  "round": { "round": 2, "label": "ครั้งที่ 2", "start": "2026-10-29", "end": "2026-11-04", "due": "2026-11-06" },
  "districtsTotal": 11, "reportedCount": 0, "statusCounts": { "accepted": 0, "submitted": 0, "draft": 0, "returned": 0, "none": 11 },
  "items": [{ "id": "R31", "label": "ไถกลบตอซัง/การใช้สารย่อยสลาย", "unit": "ไร่", "week": null, "cumulative": null, "districtsYes": 0 }],
  "byDistrict": [{ "code": "6201", "sourceCode": "D01", "name": "เมืองกำแพงเพชร", "status": "none", "items": { "R31": { "week": null, "cumulative": null } } }],
  "series": [{ "round": 1, "label": "ครั้งที่ 1", "start": "2026-10-22", "end": "2026-10-28", "reported": 0, "values": { "R31": { "week": null, "cumulative": null } } }]
}
```

- `code` = รหัสอำเภอ (amp_code) ตรงกับขอบเขตใน `Districts.gs`
- `null` = ยังไม่มีรายงาน (ไม่ใช่ 0)
- ถ้าเรียกไม่สำเร็จ: `{ "ok": false, "configured": true|false, "error": "..." }` ส่วนอื่นของ summary ยังทำงาน
- คีย์ไม่ถูกส่งไปที่ browser (มีเทสต์ตรวจ)

## 1.6.0: `data.crops` (ข้อมูลเพาะปลูก)

```json
"crops": { "ok": true, "source": "ระบบฐานข้อมูลทะเบียนเกษตรกรกลาง กรมส่งเสริมการเกษตร", "crops": [{
  "crop": "ข้าวนาปี", "season": "2569/70", "material": "ฟางข้าว", "monthType": "harvest",
  "asOfMonth": 202610, "currentMonth": 202611,
  "totalRai": 1177773.92, "harvestedRai": 912774.35, "remainingRai": 264999.57, "currentMonthRai": 199680.82, "nextMonthRai": 58147.83,
  "months": [{ "month": 202607, "areaRai": 7333.8, "households": 364, "plots": 590 }],
  "byDistrict": [{ "code": "6201", "name": "เมืองกำแพงเพชร", "totalRai": 173887, "harvestedRai": 140613, "remainingRai": 33273, "months": { "202607": 1765.5 } }],
  "residue": null } ] }
```

- `asOfMonth` = เดือนที่ผ่านมา (คงเหลือ = total − ผลรวมเดือน ≤ asOfMonth) หน้าเว็บเลือกเดือนอื่นได้ โดยคำนวณจาก `months`
- `residue` มีค่าเมื่อกำหนด BioRate (ตัน/ไร่) ของชนิดวัสดุเหลือใช้ทางการเกษตรใน `Research_Refs`

### รายตำบล

`/exec?api=v1&endpoint=crop&crop=ข้าวนาปี&season=2569/70&district=6201` → `{ subdistricts: [{ code, name, totalRai, harvestedRai, remainingRai, months }] }`

## Admin API (POST)

`POST /exec` body (text/plain): `{"method":"…","args":[…],"token":"…"}` → `{ok, result|error}`
- `adminLoginServer({username,password})` คืน `token` (2 ชั่วโมง)
- Admin: `cropTypesListServer`, `cropTypeSaveServer`, `cropImportCheckServer`, `cropImportCommitServer`, `cropImportsListServer`, `cropImportDeleteServer`, `cacheClearServer`, `adminMeServer`, `adminChangePasswordServer`, `adminLogoutServer`
- Super Admin: `settingsGetServer`, `settingsSaveServer`, `smartAgriTestServer`, `adminsListServer`, `adminSaveServer`, `adminResetPasswordServer`, `adminLogServer`
- RPC ของเกษตรกร/ผู้รับซื้อเรียกผ่าน POST ไม่ได้

## 1.7.0: ตัวนับผู้เข้าชม และรายงาน

- `GET /exec?api=v1&endpoint=hit` นับ 1 ครั้ง (หน้าเว็บเรียกครั้งแรกของ session) → `{ today, month, total, date }`
- `GET /exec?api=v1&endpoint=visits` อ่านอย่างเดียว (cache 60 วินาที) → รูปแบบเดียวกัน
- Admin: `reportCatalogServer()` → หมวด/ส่วนรายงานที่สิทธิ์นี้เลือกได้ และรายการพืช
- Admin: `reportDataServer({sections:[…], crop, season, asOf, title, unmaskPhones})` → `{ title, generatedAt, generatedBy, phonesMasked, sections:[{ key, title, columns, rows, totals, notes }] }` (สูงสุด 20 ส่วน; ส่วน `market.plots`, `market.buyers`, `audit.log` เฉพาะ Super Admin; `unmaskPhones` มีผลเฉพาะ Super Admin)
- Admin: `reportExportLogServer({format:'print'|'xlsx'|'csv', sections})` บันทึกการส่งออก

## 2.0.0: การจัดการวัสดุเหลือใช้ทางการเกษตรและ GHG

- `GET /exec?api=v1&endpoint=residue[&fy=2570]` (สาธารณะ, cache 5 นาที, ไม่มีชื่อ พิกัด ภาพ หรือรหัสรายการ) →
  `{ fy, fyRange, fiscalYears, province, params:{label, gwpSet, combinedEf, mode, version}, crops, methods, cells:[{d, c, m, n, a, t, g, ch4, n2o, ch4e, n2oe, b, x}], totals, targets:{total, officers, byMethod, byDistrict}, boundary }`
  - `cells` = ผลรวม อำเภอ × พืช × ประเภท: `a` ไร่, `t` ตันวัสดุเหลือใช้ทางการเกษตร, `g` tCO2e ที่ลดได้, `x` ไร่ที่ยังไม่คำนวณ GHG
- `summary` มี `province` เพิ่ม
- Admin (ทุกระดับ, Admin เห็นเฉพาะอำเภอตัวเอง): `residueMetaServer`, `residueSaveServer`, `residueListServer`, `residueDeleteServer`, `residuePhotoServer`, `ghgValidationServer`
- Mini Super Admin / Super Admin: `ghgSettingsServer`, `ghgParamsSaveServer`, `ghgCropSaveServer`, `ghgCalculateServer`, `residueSettingsServer`, `residueTargetsSaveServer`, `residueMethodSaveServer`, `siteSaveServer` และเมธอดผู้ดูแลเดิมทั้งหมด (Mini จัดการบัญชี Super Admin ไม่ได้)
- รายงานกลุ่ม `residue.*` (summary, map, methods, districts, crops, subdistricts, admins, records, params) รับ `fy`, `district`

## 2.1.0: มูลค่าและการลงทะเบียนเจ้าหน้าที่

- `residue` endpoint: `cells[].v` มูลค่า (บาท), `totals.value`, `crops[].priceBahtKg`, `methods[].countValue`
- POST ไม่ต้องล็อกอิน: `staffMetaServer` (จังหวัด หน่วยงาน กลุ่ม อำเภอ), `staffRegisterServer({name, phone, officeType, group, district, province})` → session ทันที, `staffLoginServer({phone})`
- `ghgCropSaveServer` รับ `priceBahtKg`, `priceReference`; `residueMethodSaveServer` รับ `countValue`; `siteSaveServer` รับ `groups`


## 2.2.0: สมดุลวัสดุเหลือใช้ทางการเกษตร ราคากลาง รายงาน 4 แบบ

- `GET /exec?api=v1&endpoint=balance[&fy=2570]` (สาธารณะ, cache 5 นาที, ไม่มีชื่อ เบอร์ หรือพิกัด) →
  `{ fy, fyRange, totals, byDistrict:[{district, name, harvestedRai, potentialTon, removableTon, listedRai, buyers, managedRai, managedPct, atRiskRai, flags}], rows:[อำเภอ × พืช], months:[{month, harvestedRai, managedRai}], sources }`
  - flags: `need_buyer` (มีแปลงประกาศขายแต่ไม่มีผู้รับซื้อในอำเภอ), `low_managed` (จัดการ < 20% ของพื้นที่เก็บเกี่ยว)
- POST `residueBalanceServer({fy, district})` (Admin: อำเภอตัวเองเท่านั้น), `residuePriceSaveServer({price, reference})` (Mini/Super)
- `residueSaveServer` รับ `buyerId`, `soldTonnes` (ไม่บังคับ); `residueMetaServer` คืน `buyers` (id, ชื่อ, ชนิดวัสดุ, อำเภอ ไม่มีเบอร์)
- `ghgCropSaveServer` รับ `useGlobalPrice`, `priceBahtKg` (ราคาเฉพาะพืช), `removablePct`, `removableReference`; `ghgSettingsServer` คืน `price`
- `reportCatalogServer` คืน `types` (district, province, ghg, register); ส่วนรายงานใหม่ `residue.balance`, `residue.ghgcrops`; คอลัมน์ `printHide` ไม่พิมพ์แต่อยู่ใน Excel/CSV, ส่วน `landscape` พิมพ์แนวนอน
- หน่วย: `ตันคาร์บอนไดออกไซด์เทียบเท่า` (เดิม tCO2e); `loginServer` แจ้ง `STAFF_ACCOUNT:` และ `staffLoginServer` แจ้ง `MARKET_ACCOUNT:` เมื่อกรอกเบอร์ผิดช่อง

## 2.2.1

- `registerServer` (เกษตรกร/ผู้รับซื้อ) คืน session ทันที: `{ token, phone, role, name }` เหมือน `loginServer`
