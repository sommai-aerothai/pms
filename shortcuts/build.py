#!/usr/bin/env python3
"""สร้างคำสั่งลัด "ส่งเข้า PMS" (.shortcut) จาก bookmarklet/sarabun-to-pms.js (ตัวอ่านเดียวกับบุ๊กมาร์กเล็ต)
ใช้: python3 shortcuts/build.py [ที่อยู่แอป]   เช่น https://sommai-aerothai.github.io/pms/  (ค่าเริ่มต้น = preview)
ได้ shortcuts/ส่งเข้า-PMS.unsigned.shortcut แล้วลงนามด้วย: shortcuts --sign… (ดู README.md)"""
import plistlib, re, sys, uuid, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
base = sys.argv[1] if len(sys.argv) > 1 else 'https://sommai-aerothai.github.io/pms/preview/'
src = (root / 'bookmarklet/sarabun-to-pms.js').read_text(encoding='utf-8')
# ย่อเหมือน minify() ใน js/import-sarabun.js แต่คงบรรทัดไว้ (ไม่ต้องบรรทัดเดียวใน Shortcuts) · แทนที่อยู่แอป
js = '\n'.join(l.strip() for l in src.split('\n') if l.strip() and not l.strip().startswith('//'))
js, n = re.subn(r"var APP = '[^']*';", "var APP = '%s';" % base.replace("'", '%27'), js, count=1)
assert n == 1
uid = str(uuid.uuid4()).upper()
wf = {
    'WFWorkflowClientVersion': '1200', 'WFWorkflowMinimumClientVersion': 900, 'WFWorkflowMinimumClientVersionString': '900',
    'WFWorkflowIcon': {'WFWorkflowIconStartColor': 431817727, 'WFWorkflowIconGlyphNumber': 59771},
    'WFWorkflowImportQuestions': [], 'WFWorkflowTypes': ['ActionExtension'],
    'WFWorkflowInputContentItemClasses': ['WFSafariWebPageContentItem'],
    'WFWorkflowHasShortcutInputVariables': True,
    'WFWorkflowActions': [
        {'WFWorkflowActionIdentifier': 'is.workflow.actions.runjavascriptonwebpage',
         'WFWorkflowActionParameters': {'UUID': uid, 'WFJavaScript': js}},
        {'WFWorkflowActionIdentifier': 'is.workflow.actions.openurl',
         'WFWorkflowActionParameters': {'WFInput': {'Value': {'string': '￼', 'attachmentsByRange': {
             '{0, 1}': {'Type': 'ActionOutput', 'OutputUUID': uid, 'OutputName': 'JavaScript Result'}}},
             'WFSerializationType': 'WFTextTokenString'}}},
    ],
}
out = root / 'shortcuts/ส่งเข้า-PMS.unsigned.shortcut'
with open(out, 'wb') as f: plistlib.dump(wf, f, fmt=plistlib.FMT_BINARY)
print(out, 'JS', len(js), 'bytes · แอป', base)
