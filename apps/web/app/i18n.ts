import { guideEn, guideTh } from "./i18n-guide";
import { landingEn, landingTh } from "./i18n-landing";
import { studioEn, studioTh } from "./i18n-studio";
import { wsEn, wsTh } from "./i18n-workspace";

export const LANGS = ["en", "th"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_KEY = "cc-lang";
export const THEME_KEY = "cc-theme";

const en = {
  skipToContent: "Skip to content",
  siteName: "Cold Chain Simulation Studio",
  siteNameShort: "Cold Chain Studio",
  navPrimary: "Primary",
  navWorkspace: "Workspace",
  environment: "Synthetic environment",
  language: "Language",
  theme: "Theme",
  themeLight: "Light",
  themeDark: "Dark",
  switchToDark: "Switch to dark theme",
  switchToLight: "Switch to light theme",
  footerEvidence: "Evidence / Scenarios / Human review",
  footerDisclaimer: "Decision support only. Does not certify food safety.",

  brandTitle: "Brand and design tokens",
  brandIntro:
    "Internal reference for the Frost paper visual system. Not linked from the product navigation.",
  brandLogo: "Logo: The Gap",
  brandLogoNote:
    "One route stroke runs from cold blue to amber with a single break in the middle. The break stands for a data gap that the product never fills in.",
  brandOnLight: "On light",
  brandOnDark: "On dark",
  brandMarkColour: "Color mark",
  brandMarkMono: "Monochrome mark",
  brandLockup: "Lockup",
  brandFavicon: "Favicon",
  brandColour: "Color tokens",
  brandColourNote:
    "Contrast ratios are measured live from the active theme. Body text needs at least 4.5 : 1.",
  brandPair: "Pair",
  brandRatio: "Contrast",
  brandThermal: "Thermal scale",
  brandThermalNote:
    "Saturated color is reserved for temperature data. Cold on the left, hot on the right.",
  brandUnknown: "Unknown data",
  brandUnknownNote:
    "Missing readings are never interpolated and never shown as compliant. They are hatched grey.",
  brandNoReadings: "No readings",
  brandStatus: "Status badges",
  brandStatusNote:
    "Each status has a shape, a label and a color. No status is shown as safe, certified or approved.",
  brandProvenance: "Provenance chips",
  brandProvenanceNote: "Shown beside a figure so its origin is clear.",
  brandType: "Type scale",
  brandTypeNote:
    "IBM Plex Sans and IBM Plex Sans Thai for text, IBM Plex Mono with tabular numerals for figures.",
  brandSample: "Chilled strawberries, demo range",
  statusEligible: "Eligible",
  statusReview: "Review required",
  statusBlocked: "Blocked",
  statusInsufficient: "Insufficient data",
  statusNotEvaluated: "Not evaluated",
  provObserved: "Observed",
  provEntered: "Entered",
  provCalculated: "Calculated",
  provEstimated: "Estimated",
  ...studioEn,
  ...guideEn,
  ...landingEn,
  ...wsEn,
} as const;

export type Dict = { [K in keyof typeof en]: string };
export type DictKey = keyof Dict;

const th: Dict = {
  skipToContent: "ข้ามไปยังเนื้อหา",
  siteName: "Cold Chain Simulation Studio",
  siteNameShort: "Cold Chain Studio",
  navPrimary: "เมนูหลัก",
  navWorkspace: "พื้นที่ทำงาน",
  environment: "สภาพแวดล้อมจำลอง",
  language: "ภาษา",
  theme: "ธีม",
  themeLight: "สว่าง",
  themeDark: "มืด",
  switchToDark: "เปลี่ยนเป็นธีมมืด",
  switchToLight: "เปลี่ยนเป็นธีมสว่าง",
  footerEvidence: "หลักฐาน / สถานการณ์จำลอง / การทบทวนโดยคน",
  footerDisclaimer:
    "ใช้สนับสนุนการตัดสินใจเท่านั้น ไม่ใช่การรับรองความปลอดภัยของอาหาร",

  brandTitle: "แบรนด์และโทเคนการออกแบบ",
  brandIntro:
    "เอกสารอ้างอิงภายในของระบบภาพ Frost paper ไม่มีลิงก์จากเมนูของผลิตภัณฑ์",
  brandLogo: "โลโก้ The Gap",
  brandLogoNote:
    "เส้นทางเส้นเดียวไล่จากสีน้ำเงินเย็นไปเป็นสีอำพัน และขาดช่วงหนึ่งจุดตรงกลาง ช่องว่างนี้แทนข้อมูลที่หายไป ซึ่งระบบจะไม่เติมให้เอง",
  brandOnLight: "บนพื้นสว่าง",
  brandOnDark: "บนพื้นมืด",
  brandMarkColour: "สัญลักษณ์แบบสี",
  brandMarkMono: "สัญลักษณ์สีเดียว",
  brandLockup: "โลโก้พร้อมชื่อ",
  brandFavicon: "ไอคอนแท็บเบราว์เซอร์",
  brandColour: "โทเคนสี",
  brandColourNote:
    "ค่าคอนทราสต์วัดจากธีมที่ใช้อยู่ขณะนี้ ข้อความทั่วไปต้องไม่ต่ำกว่า 4.5 : 1",
  brandPair: "คู่สี",
  brandRatio: "คอนทราสต์",
  brandThermal: "สเกลอุณหภูมิ",
  brandThermalNote: "สีสดใช้กับข้อมูลอุณหภูมิเท่านั้น ซ้ายคือเย็น ขวาคือร้อน",
  brandUnknown: "ข้อมูลที่ไม่ทราบ",
  brandUnknownNote:
    "ช่วงที่ไม่มีค่าอ่านจะไม่ถูกประมาณและไม่ถูกแสดงว่าเป็นไปตามเกณฑ์ แสดงเป็นลายเส้นเฉียงสีเทา",
  brandNoReadings: "ไม่มีค่าอ่าน",
  brandStatus: "ป้ายสถานะ",
  brandStatusNote:
    "ทุกสถานะมีรูปทรง ข้อความ และสี และไม่มีสถานะใดแสดงว่าปลอดภัย ผ่านการรับรอง หรืออนุมัติแล้ว",
  brandProvenance: "ป้ายแหล่งที่มา",
  brandProvenanceNote: "วางไว้ข้างตัวเลขเพื่อให้รู้ว่าค่านั้นมาจากไหน",
  brandType: "สเกลตัวอักษร",
  brandTypeNote:
    "ใช้ IBM Plex Sans และ IBM Plex Sans Thai สำหรับข้อความ และ IBM Plex Mono แบบตัวเลขกว้างเท่ากันสำหรับตัวเลข",
  brandSample: "สตรอว์เบอร์รีแช่เย็น ช่วงอุณหภูมิตัวอย่าง",
  statusEligible: "เข้าเกณฑ์",
  statusReview: "ต้องทบทวน",
  statusBlocked: "ถูกบล็อก",
  statusInsufficient: "ข้อมูลไม่เพียงพอ",
  statusNotEvaluated: "ยังไม่ได้ประเมิน",
  provObserved: "วัดได้จริง",
  provEntered: "ผู้ใช้กรอก",
  provCalculated: "คำนวณแล้ว",
  provEstimated: "ประมาณการ",
  ...studioTh,
  ...guideTh,
  ...landingTh,
  ...wsTh,
};

export const dictionaries: Record<Lang, Dict> = { en, th };

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "th";
}
