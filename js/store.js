// สัญญา data layer เดียวที่หน้าจอรู้จัก · backend เลือกจาก localStorage 'pms.backend' (ค่าเริ่ม 'demo')
import * as demo from './backend/demo.js';
import { wipe as wipePhotos } from './photos.js';
import * as sharepoint from './backend/sharepoint.js';
import * as supabase from './backend/supabase.js';
import { CONFIG } from './config.js';
import * as sh from './shapes.js';

const ls = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },   // false = พื้นที่เต็ม
};
const BE = { demo, sharepoint, supabase };
export const backendName = () => { let v; try { v = localStorage.getItem('pms.backend'); } catch {} return BE[v] ? v : BE[CONFIG.backend] ? CONFIG.backend : 'demo'; };   // ค่าดิบ ไม่ใช่ JSON
const be = () => BE[backendName()];
export const setBackend = n => { try { localStorage.setItem('pms.backend', n); } catch {} };
export const auth = () => be();   // signIn / changePassword / me (เฉพาะ backend จริง)

// ทุกชุดข้อมูลผ่าน shapes.js → หน้าจอเห็นโครงเดียวไม่ว่า backend ไหน (ดูช่องที่ใช้ได้ในหัว shapes.js)
export const listReports = async () => (await be().listExamples()).map(sh.report);   // S.docs = ตัวอย่างรายงาน (examples) เท่านั้น
export const listTemplates = async () => (await be().listTemplates()).map(sh.template).filter(t => t.cat !== 'ann');   // หนังสือขออนุมัติ (รหัสเดียวกับฟอร์ม) ไม่ใช่แม่แบบ
export const getCatalog = async () => sh.catalog(await be().getCatalog());
export const getFiles = async () => (await be().getFiles()).map(sh.cat);   // หมวดเอกสารเว็บกอง (documents)
// ลิงก์ไฟล์จริง: bucket มาจากชนิดข้อมูล (doc → docs · report → examples) · ไม่มี storagePath = null (ใช้ sourceUrl แทน)
export const fileUrl = it => it && it.storagePath && be().signUrl ? be().signUrl(it.bucket, it.storagePath) : Promise.resolve(null);

// งาน PM = jobs[]: ค่าที่พิมพ์/รูปเก็บในเครื่อง (localStorage 'pms.job.<id>') · งานที่ผู้ใช้สร้างเก็บรายการ id ไว้ที่ 'pms.jobx'
export const listJobs = async () => {
  const hid = ls.get('pms.jobhid') || [], seed = (await be().listJobs()).map(sh.job).filter(j => !hid.includes(j.id)), mine = (ls.get('pms.jobx') || []).map(id => ls.get('pms.job.' + id)).filter(Boolean);
  return [...seed.map(j => ({ ...j, ...ls.get('pms.job.' + j.id) })), ...mine].map(sh.job);
};
// วันนี้ (ตามเวลาไทย) · demo ใช้วันสมมติ (ดู demo.js) เพื่อให้ตารางปีงบ 2569 มี "เดือนนี้/เดือนหน้า"
export const today = () => be().today ? be().today() : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
// รอบก่อนของสถานี: วิศวกรเฝ้าระวัง + เครื่องมือ (จาก backend) · การเดินทาง/วิศวกรที่เคยเลือกจำต่อสถานีในเครื่องนี้
export const prevRound = (key, site) => { const b = (be().prevRound ? be().prevRound(site) : {}), m = pref('last.' + key) || {}; return { eng: [...new Set([...(m.eng || []), ...(b.eng || [])])], travel: m.travel || b.travel || '', tools: b.tools || [] }; };
export const rememberRound = (key, eng, travel) => { const m = pref('last.' + key) || {}; pref('last.' + key, { eng: [...new Set([eng, ...(m.eng || [])].filter(Boolean))].slice(0, 6), travel: travel || m.travel || '' }); };
// ลบงาน (demo): งานที่ผู้ใช้สร้างลบจริง · งานตัวอย่างจาก backend ซ่อนไว้ (pms.jobhid)
export const dropJob = id => { ls.set('pms.jobhid', [...(ls.get('pms.jobhid') || []), id]); ls.set('pms.jobx', (ls.get('pms.jobx') || []).filter(x => x !== id)); try { localStorage.removeItem('pms.job.' + id); } catch {} };
export const putJob = job => ls.set('pms.job.' + job.id, job);
// งานใหม่ (ผู้ใช้เปิดเอง): เก็บในเครื่อง + จดดัชนี · false = พื้นที่เต็ม
export const addJob = job => {
  if (!putJob(job)) return false;
  if (!ls.set('pms.jobx', [...(ls.get('pms.jobx') || []), job.id])) { try { localStorage.removeItem('pms.job.' + job.id); } catch {} return false; }   // ดัชนีเขียนไม่ได้ = ไม่ถือว่าสร้างสำเร็จ
  return true;
};

// ค่าตั้ง/ผู้ใช้/รายการเก็บ offline
export const pref = (k, v) => (v === undefined ? ls.get('pms.' + k) : ls.set('pms.' + k, v));
export const isOffline = (id, dflt) => { const s = ls.get('pms.offline') || {}; return id in s ? s[id] : dflt; };
export const setOffline = (id, on) => ls.set('pms.offline', { ...(ls.get('pms.offline') || {}), [id]: on });
export const offlineCount = () => Object.values(ls.get('pms.offline') || {}).filter(Boolean).length;
// ออกจากระบบ: ลบเฉพาะคีย์ pms.* (+ รูปของ PMS) · ไม่แตะข้อมูลอื่นบนออริจินเดียวกัน
export const signOut = async () => {
  try { Object.keys(localStorage).filter(k => k.startsWith('pms.') && k !== 'pms.backend').forEach(k => localStorage.removeItem(k)); } catch {}
  await wipePhotos();
};
