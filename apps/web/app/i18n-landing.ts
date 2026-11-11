/** Strings for the landing page. Codes such as QA, UTC, DEMO-001 stay in English. */
export const landingEn = {
  lpHeroH1: "Cold-chain excursion simulator for QA teams",
  lpHeroLead:
    "Replay a delayed shipment, see where the temperature record has gaps, and weigh 4 ways to proceed before logistics hands a proposal to QA.",
  lpHeroFact: "Gaps stay unknown. No interpolation.",
  lpOpenSim: "Open the simulator",
  lpSeeOptions: "See the four options",
  lpFrameAria: "Live replay of the demo shipment in the Simulation Studio",
  lpReplayPause: "Pause the replay",
  lpReplayPlay: "Play the replay",
  lpReplaying: "Replaying",

  lpEvH2: "The excursion chart keeps gaps unknown",
  lpEvLead:
    "When a sensor goes quiet, the chart shows a hatched gap. It is never drawn as a straight line and never counted as in range.",
  lpEvTraceAria: "Temperature record with a gap of missing readings",
  lpEvObserved: "readings observed",
  lpEvMissing: "readings missing",
  lpEvStep: "minutes between readings",

  lpScH2: "Compare four options by cost and delay",
  lpScLead:
    "Each option runs on the same clock. Cost and delay are demo estimates, and eligibility comes from the quality policy.",
  lpScSchemAria: "All four options drawn on one schematic route",
  lpScCost: "Total cost",
  lpScDelay: "Delay",

  lpQaH2: "Freeze the simulation for QA review",
  lpQaLead:
    "Once submitted, a proposal cannot change. New data or a new policy starts a new run. Only a person with the QA role records the decision.",
  lpSnapTitle: "Decision snapshot",
  lpSnapFrozen: "Frozen, read-only",
  lpSnapShipment: "Shipment",
  lpSnapScenario: "Option",
  lpSnapDataset: "Dataset",
  lpSnapDatasetVal: "{n} readings, version 1",
  lpSnapPolicy: "Quality policy",
  lpSnapAi: "AI explanation",
  lpSnapAiVal: "Not attached",
  lpQaTitle: "QA review",
  lpQaPoint1:
    "The decision is recorded with the reviewer's role, notes and time.",
  lpQaPoint2: "Admin rights do not stand in for QA review.",
  lpQaPoint3: "A blocked option stays blocked, whatever it costs.",

  lpCloseH2: "Replay a shipment in the simulator",
} as const;

export const landingTh = {
  lpHeroH1: "โปรแกรมจำลองอุณหภูมิเบี่ยงเบนในห่วงโซ่ความเย็น สำหรับทีม QA",
  lpHeroLead:
    "เล่นซ้ำการขนส่งที่ล่าช้า ดูว่าบันทึกอุณหภูมิขาดช่วงตรงไหน และเปรียบเทียบ 4 ทางเลือกก่อนที่ทีมโลจิสติกส์จะส่งข้อเสนอให้ QA",
  lpHeroFact: "ช่วงที่ไม่มีข้อมูลยังเป็นค่าที่ไม่ทราบ ไม่มีการประมาณค่า",
  lpOpenSim: "เปิดตัวจำลอง",
  lpSeeOptions: "ดูสี่ทางเลือก",
  lpFrameAria: "ภาพเล่นซ้ำสดของการขนส่งตัวอย่างใน Simulation Studio",
  lpReplayPause: "หยุดการเล่นซ้ำ",
  lpReplayPlay: "เล่นซ้ำ",
  lpReplaying: "กำลังเล่นซ้ำ",

  lpEvH2: "กราฟเหตุเบี่ยงเบนคงช่วงว่างเป็นค่าที่ไม่ทราบ",
  lpEvLead:
    "เมื่อเซนเซอร์เงียบไป กราฟจะแสดงช่วงว่างเป็นลายเส้นเฉียง ไม่ลากเป็นเส้นตรงเชื่อมกัน และไม่นับว่าอยู่ในช่วงที่กำหนด",
  lpEvTraceAria: "บันทึกอุณหภูมิที่มีช่วงค่าอ่านหายไป",
  lpEvObserved: "ค่าอ่านที่วัดได้",
  lpEvMissing: "ค่าอ่านที่หายไป",
  lpEvStep: "นาทีระหว่างค่าอ่าน",

  lpScH2: "เปรียบเทียบสี่ทางเลือกตามต้นทุนและเวลาที่เสียไป",
  lpScLead:
    "ทุกทางเลือกเดินบนนาฬิกาเดียวกัน ต้นทุนและเวลาเป็นค่าประมาณในเดโม ส่วนความเข้าเกณฑ์มาจากนโยบายคุณภาพ",
  lpScSchemAria: "ทั้งสี่ทางเลือกบนแผนผังเส้นทางเดียวกัน",
  lpScCost: "ต้นทุนรวม",
  lpScDelay: "เวลาที่ล่าช้า",

  lpQaH2: "ล็อกผลการจำลองเพื่อส่งให้ QA ทบทวน",
  lpQaLead:
    "เมื่อส่งแล้ว ข้อเสนอจะแก้ไขไม่ได้ ข้อมูลใหม่หรือนโยบายใหม่จะเริ่มการวิเคราะห์รอบใหม่ และมีเพียงผู้ที่มีบทบาท QA เท่านั้นที่บันทึกการตัดสินใจได้",
  lpSnapTitle: "สแนปช็อตการตัดสินใจ",
  lpSnapFrozen: "ล็อกแล้ว อ่านได้อย่างเดียว",
  lpSnapShipment: "การขนส่ง",
  lpSnapScenario: "ทางเลือก",
  lpSnapDataset: "ชุดข้อมูล",
  lpSnapDatasetVal: "{n} ค่าอ่าน เวอร์ชัน 1",
  lpSnapPolicy: "นโยบายคุณภาพ",
  lpSnapAi: "คำอธิบายจาก AI",
  lpSnapAiVal: "ไม่ได้แนบ",
  lpQaTitle: "การทบทวนโดย QA",
  lpQaPoint1: "การตัดสินใจถูกบันทึกพร้อมบทบาท บันทึกข้อความ และเวลาของผู้ทบทวน",
  lpQaPoint2: "สิทธิ์ผู้ดูแลระบบไม่สามารถใช้แทนการทบทวนโดย QA ได้",
  lpQaPoint3: "ทางเลือกที่ถูกบล็อกจะยังถูกบล็อก ไม่ว่าต้นทุนจะเป็นเท่าไร",

  lpCloseH2: "เล่นซ้ำการขนส่งในตัวจำลอง",
} as const;
