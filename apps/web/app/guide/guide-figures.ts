import type { DictKey } from "@/i18n";

/** One screenshot: its alt text and the numbered steps that match the callout markers. */
export type FigureDef = { alt: DictKey; steps: DictKey[] };

export const FIGURES = {
  "studio-first": {
    alt: "gdAltStudioFirst",
    steps: [
      "gdSStudioFirst1",
      "gdSStudioFirst2",
      "gdSStudioFirst3",
      "gdSStudioFirst4",
      "gdSStudioFirst5",
    ],
  },
  "studio-overview": {
    alt: "gdAltStudioOverview",
    steps: [
      "gdSStudioOverview1",
      "gdSStudioOverview2",
      "gdSStudioOverview3",
      "gdSStudioOverview4",
      "gdSStudioOverview5",
      "gdSStudioOverview6",
    ],
  },
  "studio-timeline": {
    alt: "gdAltStudioTimeline",
    steps: [
      "gdSStudioTimeline1",
      "gdSStudioTimeline2",
      "gdSStudioTimeline3",
      "gdSStudioTimeline4",
      "gdSStudioTimeline5",
    ],
  },
  "studio-gap": {
    alt: "gdAltStudioGap",
    steps: ["gdSStudioGap1", "gdSStudioGap2", "gdSStudioGap3"],
  },
  "ref-thermal": {
    alt: "gdAltRefThermal",
    steps: ["gdSRefThermal1", "gdSRefThermal2"],
  },
  "ref-status": {
    alt: "gdAltRefStatus",
    steps: ["gdSRefStatus1", "gdSRefStatus2"],
  },
  "studio-scenario": {
    alt: "gdAltStudioScenario",
    steps: [
      "gdSStudioScenario1",
      "gdSStudioScenario2",
      "gdSStudioScenario3",
      "gdSStudioScenario4",
    ],
  },
  "studio-factors": {
    alt: "gdAltStudioFactors",
    steps: [
      "gdSStudioFactors1",
      "gdSStudioFactors2",
      "gdSStudioFactors3",
      "gdSStudioFactors4",
      "gdSStudioFactors5",
    ],
  },
  "studio-chart": {
    alt: "gdAltStudioChart",
    steps: [
      "gdSStudioChart1",
      "gdSStudioChart2",
      "gdSStudioChart3",
      "gdSStudioChart4",
    ],
  },
  "studio-edit": {
    alt: "gdAltStudioEdit",
    steps: [
      "gdSStudioEdit1",
      "gdSStudioEdit2",
      "gdSStudioEdit3",
      "gdSStudioEdit4",
      "gdSStudioEdit5",
    ],
  },
  "studio-compare": {
    alt: "gdAltStudioCompare",
    steps: ["gdSStudioCompare1", "gdSStudioCompare2", "gdSStudioCompare3"],
  },
  "studio-2d": {
    alt: "gdAltStudio2d",
    steps: ["gdSStudio2d1", "gdSStudio2d2"],
  },
  "studio-mobile": {
    alt: "gdAltStudioMobile",
    steps: ["gdSStudioMobile1", "gdSStudioMobile2", "gdSStudioMobile3"],
  },
  "studio-mobile-sheet": {
    alt: "gdAltStudioMobileSheet",
    steps: [
      "gdSStudioMobileSheet1",
      "gdSStudioMobileSheet2",
      "gdSStudioMobileSheet3",
    ],
  },
  "ws-list": {
    alt: "gdAltWsList",
    steps: ["gdSWsList1", "gdSWsList2", "gdSWsList3", "gdSWsList4"],
  },
  "ws-create": {
    alt: "gdAltWsCreate",
    steps: [
      "gdSWsCreate1",
      "gdSWsCreate2",
      "gdSWsCreate3",
      "gdSWsCreate4",
      "gdSWsCreate5",
    ],
  },
  "ws-evidence-empty": {
    alt: "gdAltWsEvidenceEmpty",
    steps: [
      "gdSWsEvidenceEmpty1",
      "gdSWsEvidenceEmpty2",
      "gdSWsEvidenceEmpty3",
      "gdSWsEvidenceEmpty4",
    ],
  },
  "ws-upload": {
    alt: "gdAltWsUpload",
    steps: [
      "gdSWsUpload1",
      "gdSWsUpload2",
      "gdSWsUpload3",
      "gdSWsUpload4",
      "gdSWsUpload5",
    ],
  },
  "ws-evidence-chart": {
    alt: "gdAltWsEvidenceChart",
    steps: [
      "gdSWsEvidenceChart1",
      "gdSWsEvidenceChart2",
      "gdSWsEvidenceChart3",
    ],
  },
  "ws-policy": {
    alt: "gdAltWsPolicy",
    steps: ["gdSWsPolicy1", "gdSWsPolicy2", "gdSWsPolicy3"],
  },
  "ws-analysis": {
    alt: "gdAltWsAnalysis",
    steps: [
      "gdSWsAnalysis1",
      "gdSWsAnalysis2",
      "gdSWsAnalysis3",
      "gdSWsAnalysis4",
    ],
  },
  "ws-simulate": {
    alt: "gdAltWsSimulate",
    steps: [
      "gdSWsSimulate1",
      "gdSWsSimulate2",
      "gdSWsSimulate3",
      "gdSWsSimulate4",
      "gdSWsSimulate5",
    ],
  },
  "ws-propose": {
    alt: "gdAltWsPropose",
    steps: ["gdSWsPropose1", "gdSWsPropose2", "gdSWsPropose3", "gdSWsPropose4"],
  },
  "ws-qa": {
    alt: "gdAltWsQa",
    steps: ["gdSWsQa1", "gdSWsQa2", "gdSWsQa3", "gdSWsQa4"],
  },
  "ws-report": {
    alt: "gdAltWsReport",
    steps: ["gdSWsReport1", "gdSWsReport2", "gdSWsReport3"],
  },
} as const satisfies Record<string, FigureDef>;

export type FigureId = keyof typeof FIGURES;
