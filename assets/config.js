window.ABM_CONFIG = {
  // Apps Script Web App (/exec) ของระบบติดตามการใช้ประโยชน์วัสดุเหลือใช้ทางการเกษตร (ABM) — ไม่ใช่ Green Gain Hub หรือ Smart Agri-Materials
  // ใช้ทั้งหน้าเจ้าหน้าที่ (POST) และ Dashboard สาธารณะ (?api=v1&endpoint=summary)
  SHEETS_API_URL: 'https://script.google.com/macros/s/AKfycby7nbXMQ3_WvA7y_Mp0DTE_wMX9eyiJQbfYBlpaQBOshpUyurOFgoM7MxWMN0wLvjkdqw/exec',
  // Dashboard สาธารณะ (ว่าง = ใช้ SHEETS_API_URL)
  SUMMARY_API_URL: '',
  // ต้องตรงกับ Script Property SUMMARY_API_KEY ถ้าตั้งไว้ (คีย์นี้มองเห็นได้จากหน้าเว็บ ไม่ใช่รหัสลับ)
  SUMMARY_API_KEY: '',
  // ตลาดสำหรับเกษตรกรและผู้รับซื้อ (Green Gain Hub)
  GGH_URL: 'https://krit-pj.github.io/Green_Gain_Hub-KPP/',
  // ใช้เพื่อแสดงอ้างอิงเท่านั้น สิทธิ์อ่าน/เขียนอยู่ที่ API ไม่ได้ฝังใน GitHub
  SPREADSHEET_ID: '1wTzRcRx3sCoUZD9ykFgl17WOGVw9BtVkVwqtAftyVU4',
  REQUEST_TIMEOUT_MS: 30000,
  BUILD_VERSION: '1.8.0'
};
