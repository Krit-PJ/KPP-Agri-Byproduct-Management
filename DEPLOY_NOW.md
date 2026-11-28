# ABM 1.7.0 — ติดตั้งและ Deploy

| รายการ | ค่า |
| --- | --- |
| Apps Script | **ABM — Agri By-product Management KPP API** (`1ZRd2SmPDj6yKB3MuQe7tW1yOMfZwBFULjIDOCnN-hH-YcsqPT6CieYe8`) บัญชี noonoy.cmu |
| Web App (เวอร์ชัน 8 = 1.5.0 ชื่อระบบใหม่ + รายงานสรุปผู้บริหาร · 7 = 1.4.0 ข้อมูลตลาดรายจังหวัด · 6 = 1.3.1 เอาการล้าง PIN GGH ออก · 5 = 1.3.0 รายงานผู้บริหาร GGH + ล้าง PIN · 4 = 1.2.1 เงื่อนไขตลาด GGH เฉพาะ Super Admin · 3 = 1.2.0 ยืนยันเบอร์ + รออนุมัติ · 2 = 1.1.0 ตลาด GGH · 1 = 1.0.0) | `AKfycby7nbXMQ3_WvA7y_Mp0DTE_wMX9eyiJQbfYBlpaQBOshpUyurOFgoM7MxWMN0wLvjkdqw` |
| ฐานข้อมูล | Agri By-product Management KPP — Database (v1.0.0) `1wTzRcRx3sCoUZD9ykFgl17WOGVw9BtVkVwqtAftyVU4` |
| โฟลเดอร์ Drive | 10. Agri By-product Management |
| หน้าเว็บ | GitHub Pages จาก `frontend/` (Actions) |
| ต้องใช้ | Agri-Risk Map 3.12.4+ (scope) · Green Gain Hub 3.2.0+ (feed + abm_config + marketPhones + abm_report) · Agri-Risk Map 3.12.3+ (ตัวตนกลางรู้จัก `ABM`) |

## ไฟล์ในโปรเจกต์ Apps Script (13 ไฟล์ + manifest)

`Code.gs` (ในตัวแก้ไขภาษาไทยชื่อ "รหัส.gs"), `Districts.gs`, `Ggh.gs`, `Migrate.gs`, `Admin.gs`, `Staff.gs`, `Sso.gs`, `Crops.gs`, `Counter.gs`, `Reports.gs`, `Ghg.gs`, `Residue.gs`, `Balance.gs`, `appsscript.json` (Asia/Bangkok, V8, Web App: ดำเนินการในฐานะฉัน / ทุกคน)

## ติดตั้งครั้งแรก (ทำแล้ว 19 พ.ย. 2569)

1. วางโค้ดทุกไฟล์จาก `apps-script/`
2. รัน `migrateFromGreenGainHub()` — คัดลอกชีตเจ้าหน้าที่จาก Green Gain Hub ครั้งแรกจะขออนุญาตสิทธิ์ (Sheets, Drive, ดึง URL ภายนอก) เจ้าของบัญชีเป็นผู้กดอนุญาต
3. รัน `setupSystem()` — ตรวจ/สร้างชีต เชื่อม Green Gain Hub (สร้างกุญแจ feed) ทดสอบ feed และสรุป
4. Deploy → การทำให้ใช้งานได้รายการใหม่ → เว็บแอป → ดำเนินการในฐานะ: ฉัน · ผู้มีสิทธิ์เข้าถึง: ทุกคน
5. ใส่ URL `/exec` ใน `frontend/assets/config.js` (`SHEETS_API_URL`) แล้ว push

## ตอนสลับระบบ (ก่อน Green Gain Hub 2.6.0 ปิดหน้าเจ้าหน้าที่)

รัน `migrateFromGreenGainHub()` อีกครั้ง (เพิ่มเฉพาะแถวใหม่) แล้ว `verifyMigration()` ต้องเป็น PASS ทุกบรรทัด

## หลังติดตั้ง (Super Admin)

- **Smart Agri:** สร้าง API Key ใหม่ในระบบ Smart Agri ชื่อ "ABM — Backend proxy" แล้วกรอกที่หน้า ตั้งค่า → การเชื่อมต่อระบบอื่น (ระบบไม่แสดงคีย์ที่บันทึกแล้ว) กด "ทดสอบการเชื่อมต่อ" จากนั้นยกเลิกคีย์เดิมของ Green Gain Hub (`kpp_fa4750…`) ที่ไม่ได้ใช้แล้ว
- ระหว่างยังไม่ใส่คีย์ ส่วน "รายงานประจำสัปดาห์จากอำเภอ" บน Dashboard จะแจ้งว่ายังไม่ได้เชื่อมต่อ ส่วนอื่นใช้งานได้ตามปกติ

## อัปเดต 1.7.0 (ต้องทำ — รวม 1.5.0 ถ้ายังไม่ได้ทำ)

ไฟล์ที่เปลี่ยนตั้งแต่ 1.4.0: `Code.gs` (ในตัวแก้ไขชื่อ "รหัส.gs"), `Admin.gs`, `Reports.gs`, `Residue.gs`, `Ggh.gs` — วางทับ บันทึก แล้ว จัดการการทำให้ใช้งานได้ → แก้ไข → เวอร์ชันใหม่ (URL เดิม) → ตรวจ `?api=v1&endpoint=health` ต้องได้ `apiVersion: 1.7.0`
- ไม่ต้องสร้าง Script Property เอง: `ABM_DEVICE_SECRET` ถูกสร้างอัตโนมัติเมื่อเจ้าหน้าที่คนแรกติ๊ก "จดจำเครื่องนี้" (อย่าแชร์ค่านี้ ถ้าลบหรือเปลี่ยน ทุกเครื่องที่จดจำไว้ต้องเข้าสู่ระบบใหม่)
- ไม่ต้องแก้ Google Sheets

## อัปเดต 1.5.0

ไฟล์ที่เปลี่ยน: `Code.gs` (ในตัวแก้ไขชื่อ "รหัส.gs"), `Reports.gs`, `Residue.gs`, `Ggh.gs` — วางทับ บันทึก แล้ว จัดการการทำให้ใช้งานได้ → แก้ไข → เวอร์ชันใหม่ (URL เดิม) → ตรวจ `?api=v1&endpoint=health` ต้องได้ `apiVersion: 1.5.0` ไม่ต้องแก้ Google Sheets

## อัปเดตครั้งต่อไป

1. ตรวจว่าโค้ดในตัวแก้ไขตรงกับ `main` ก่อนแก้
2. วางไฟล์ที่เปลี่ยน → บันทึก → โหลดหน้าใหม่แล้วตรวจอีกครั้ง
3. จัดการการทำให้ใช้งานได้ → แก้ไข → เวอร์ชันใหม่ → การทำให้ใช้งานได้ (URL เดิม)
4. ตรวจ `?api=v1&endpoint=health`
