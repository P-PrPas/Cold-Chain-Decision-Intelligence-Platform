/** Strings for the user guide. Codes such as QA, CSV, UTC, DEMO-001 and status names stay in English. */
export const guideEn = {
  navGuide: "Guide",
  gdTitle: "How to use Cold Chain Simulation Studio",
  gdLead:
    "A visual walkthrough of the Studio and the Workspace. Every screenshot comes from the running app, and each numbered marker matches the numbered step beside it.",
  gdToc: "On this page",
  gdTocToggle: "Contents",
  gdHowTo: "How to use",
  gdEnlarge: "Enlarge screenshot",
  gdClose: "Close",
  gdStepsLabel: "Numbered steps for the screenshot",
  gdTryStudio: "Open the Studio",
  gdTryWorkspace: "Open the Workspace",
  gdDemoNote:
    "The Studio uses made-up demo data. Screenshots of the Workspace use synthetic data too.",

  gdTocQuick: "Quick start",
  gdTocTour: "Studio tour",
  gdTocPlayback: "Playback",
  gdTocHonest: "Reading the data honestly",
  gdTocScenarios: "Scenarios and what-ifs",
  gdTocKeys: "Keyboard shortcuts",
  gdTocMobile: "On a phone",
  gdTocWorkspace: "Real work in the Workspace",
  gdTocWsList: "Shipments",
  gdTocWsEvidence: "Evidence",
  gdTocWsPolicy: "Policy and analysis",
  gdTocWsSim: "Simulate and propose",
  gdTocWsQa: "QA review and report",
  gdTocFaq: "Questions and fixes",
  gdTocSafety: "What this tool does not do",

  /* Quick start */
  gdQuickH: "Quick start",
  gdQuickLead:
    "Open the Studio from the header. You land on DEMO-001, a shipment of strawberries from Chiang Mai to Bangkok whose temperature rose during the trip.",
  gdQuickP1:
    "On your first visit the truck drives the journey by itself for about 8 seconds and stops at the decision point. Later visits start at that point. The Reset button (or R) plays the journey again from the start.",
  gdQuickP2:
    "Pick one of the four scenarios and the truck drives that branch. Nothing you do in the Studio is saved or sent anywhere.",
  gdAltStudioFirst:
    "The Studio on first visit: scenario list on the left, the 3D diorama in the middle with a coach mark, the result card on the right and the timeline along the bottom.",
  gdSStudioFirst1:
    "The coach mark appears once, when the truck reaches the decision point. Press Got it to dismiss it, or just pick a scenario.",
  gdSStudioFirst2:
    "The four scenarios. Click one, or press 1 to 4 on the keyboard.",
  gdSStudioFirst3:
    "The diorama. The truck has stopped at the decision point and its cargo box glows with the temperature at that moment.",
  gdSStudioFirst4:
    "The result card for the selected scenario: delay, cost, the receiver assumption and eligibility.",
  gdSStudioFirst5:
    "The timeline. The marker sits at the decision point, at the end of the recorded journey.",

  /* Tour */
  gdTourH: "Studio layout tour",
  gdTourLead:
    "The Studio has one job: show what happened to the cargo, what the options are and what each option costs. The screen has five parts.",
  gdAltStudioOverview:
    "The Studio at 1440 pixels wide with six numbered areas: shipment header, scenario list, 3D diorama, result card, assumptions panel and timeline.",
  gdSStudioOverview1:
    "Shipment header. Use the picker to switch between DEMO-001, DEMO-002 and DEMO-003. The Synthetic demo only label is always shown.",
  gdSStudioOverview2:
    "Scenario list with delay and cost for each option. The tag Illustrative pick highlights one option for the demo. It is not a policy decision.",
  gdSStudioOverview3:
    "The diorama. It is a schematic, not a GPS map. Buttons inside it change the camera and start compare mode.",
  gdSStudioOverview4:
    "Result card: additional delay, direct cost, the receiver acceptance assumption and eligibility.",
  gdSStudioOverview5:
    "Adjust assumptions: tabs for Delay, Cost, Receiver and Advanced. The result updates as soon as you change a value.",
  gdSStudioOverview6:
    "Timeline scrubber: temperature over the journey, plus play, pause and speed controls.",
  gdTourNote:
    "Under the timeline you also find a Temperature evidence strip (how many readings exist, the range, and a table of every reading) and a Prepare a proposal preview. The preview saves nothing. Real proposals are made in the Workspace.",

  /* Playback */
  gdPlayH: "Playback",
  gdPlayLead:
    "The timeline drives the whole scene. The truck, the ribbon behind it and the readout all follow the same clock.",
  gdAltStudioTimeline:
    "Close-up of the timeline bar: play button, speed buttons, colour legend, the temperature track and the decision marker.",
  gdSStudioTimeline1:
    "Play, Pause or Replay. Space does the same when no button has focus.",
  gdSStudioTimeline2:
    "Speed: 0.5x, 1x or 2x. The choice stays for the whole session.",
  gdSStudioTimeline3:
    "Colour legend: Cooler, Warmer and Unknown. The scale is for display. It is not a limit.",
  gdSStudioTimeline4:
    "The track. Drag or click to scrub to any moment. With the track focused, the left and right arrows move 5 minutes, and Shift plus an arrow moves 30.",
  gdSStudioTimeline5:
    "Decision marker. Playback stops here on its own. To the right is the scenario run, drawn after you choose an option.",
  gdPlayNote:
    "Each reading holds until the next one arrives. The chart is a staircase, never a smooth line, because the Studio does not invent temperatures between readings.",

  /* Honest data */
  gdHonestH: "Reading the data honestly",
  gdHonestLead:
    "The Studio is built so that missing evidence is visible. Learn these four signals and you can read any screen in the app.",
  gdAltStudioGap:
    "DEMO-003 paused inside its sensor gap. The scene shows a No readings 09:30 to 10:30 label, the readout says Unknown, and the timeline has a hatched band.",
  gdSStudioGap1:
    "A gap in the sensor record. The ribbon stops, the truck turns grey and a No readings label names the missing period.",
  gdSStudioGap2:
    "The readout shows Unknown with a hatched swatch. It does not show a guessed temperature.",
  gdSStudioGap3:
    "On the timeline the same period is hatched grey. Nothing is drawn across it.",
  gdHonestGapP:
    "Try it: choose DEMO-003 in the picker, then drag the timeline into the 09:30 to 10:30 range. A gap is unknown time. It is never filled in and never counted as in range.",
  gdAltRefThermal:
    "The thermal colour scale from cold blue through light blue and amber to red-orange, and the grey hatched sample used for unknown data.",
  gdSRefThermal1:
    "Thermal scale: cold blue, light blue, amber, red-orange. Colour is only used for temperature.",
  gdSRefThermal2:
    "Grey diagonal hatching always means unknown or no readings, on the chart, in the 3D scene and on badges.",
  gdAltRefStatus:
    "The five status badges and the four provenance chips as they appear in the app.",
  gdSRefStatus1:
    "Status badges. Each has an icon shape and a text label, so colour is never the only signal.",
  gdSRefStatus2:
    "Provenance chips, placed beside a figure to say where it comes from.",
  gdStatusH: "Status badges",
  gdStatusColStatus: "Badge",
  gdStatusColMeaning: "What it means",
  gdStEligible:
    "The engine found no rule that blocks or holds this option under the approved policy. It is still a decision for people, not a clearance.",
  gdStReview:
    "A rule needs a person to look at the evidence before the option can go forward.",
  gdStBlocked:
    "A hard rule in the policy rules this option out. Cost, delay, weights and review notes cannot change that.",
  gdStInsufficient:
    "There is not enough evidence to judge this option, for example a gap in the readings. Add the missing evidence and recalculate.",
  gdStNotEvaluated:
    "No engine run exists. The Studio always shows this, because it is a demo.",
  gdProvH: "Provenance chips",
  gdProvColChip: "Chip",
  gdProvColMeaning: "Where the figure comes from",
  gdPvObserved: "Measured by a sensor and recorded in the data.",
  gdPvEntered:
    "Typed in or changed by a person. Edited assumptions are user estimates.",
  gdPvCalculated: "Worked out by the engine from observed and entered values.",
  gdPvEstimated:
    "A prepared estimate that nobody has confirmed. Demo figures are of this kind.",

  /* Scenarios */
  gdScenH: "Scenarios, what-ifs and cameras",
  gdScenLead:
    "Choosing a scenario sends the truck down that branch. The delay clock and the cost ticker count up until they reach the exact total for the option.",
  gdAltStudioScenario:
    "Hold for inspection after its run has finished: the scenario is highlighted, the delay clock and cost ticker show their totals, and the result card has updated.",
  gdSStudioScenario1:
    "The selected scenario is highlighted. Switch with a click or with keys 1 to 4.",
  gdSStudioScenario2:
    "Delay clock and cost ticker for the chosen branch. They end on the exact total, to the cent.",
  gdSStudioScenario3:
    "The result card follows the selection. Figures carry a provenance chip, and Eligibility stays Not evaluated in the demo.",
  gdSStudioScenario4:
    "The time readout shows scenario time and says Unknown. After the last reading the Studio has no temperature model, so it shows no temperature.",
  gdWhatIfH: "Change a factor and see the what-if",
  gdWhatIfLead:
    "Open the Adjust assumptions panel to change the delay, the cost components or the receiver assumption. Use the preset chips for a one-click experiment. After a change, a ghost of the previous value stays on screen for about a second so you can see what moved.",
  gdAltStudioFactors:
    "After changing the delay to 240 minutes: preset chips above the scene, a Was chip showing the previous value, the factor tabs, the delay field and the result with its baseline line.",
  gdSStudioFactors1:
    "Preset chips. Inspection takes 4 h? sets the hold delay to 240 minutes. New receiver rejects? assumes rejection on the reroute option. Both replay the branch.",
  gdSStudioFactors2:
    "The ghost chip: what the delay and cost were before your change. It fades after about a second.",
  gdSStudioFactors3:
    "Factor tabs: Delay, Cost, Receiver, Advanced. Advanced holds ranking weights, which affect ranking only, never evidence or eligibility.",
  gdSStudioFactors4:
    "Type a value or use the slider. Invalid input is flagged in place and is not used.",
  gdSStudioFactors5:
    "The result card keeps a baseline line, so you can read the difference. An edited figure switches from Estimated to Entered. Reset to baseline undoes your edits.",
  gdCompareH: "Compare mode",
  gdCompareLead:
    "Press C or use the Compare button to run all four scenarios side by side on the same clock. Each truck carries its scenario number.",
  gdAltStudioCompare:
    "Compare mode: four trucks, numbered 1 to 4, on their own branches at the same time.",
  gdSStudioCompare1: "Compare button. Press it again, or press C, to leave.",
  gdSStudioCompare2:
    "Four ghost trucks, each tagged with its scenario number, move on a shared time scale.",
  gdSStudioCompare3:
    "The timeline replays the scenario run. Scenario time is schematic and has no readings.",
  gdCameraH: "Camera modes and reset",
  gdCameraLead:
    "Overview is the default isometric view. Follow truck keeps the truck in frame. 2D is a flat top-down schematic that carries the same information, and it is also what you get automatically when the browser cannot draw 3D.",
  gdAltStudio2d:
    "The 2D top-down schematic of the same scenario with the camera buttons above it.",
  gdSStudio2d1: "Camera buttons: Overview, Follow truck and 2D.",
  gdSStudio2d2:
    "The 2D view shows the same route, labels and scenario state as the 3D scene.",
  gdResetP:
    "Reset (or R) returns the factors to their prepared values, leaves compare mode and replays the journey from the start.",

  /* Keys */
  gdKeysH: "Keyboard shortcuts",
  gdKeysLead:
    "Shortcuts work anywhere on the Studio page except inside a form field. Space is left alone while a button or link has focus, so it still activates that control.",
  gdKeyCol: "Key",
  gdKeyDoes: "What it does",
  gdKeySpace: "Play or pause",
  gdKeyArrows: "Move the playhead 5 minutes back or forward",
  gdKeyShiftArrows: "Move the playhead 30 minutes back or forward",
  gdKeyC: "Turn compare mode on or off",
  gdKeyR: "Reset",
  gdKey14: "Select scenario 1 to 4",
  gdKeyEsc: "Dismiss the coach mark, or close the assumptions sheet on a phone",

  /* Mobile */
  gdMobileH: "On a phone",
  gdMobileLead:
    "On narrow screens (760 pixels or less) the 3D scene stays pinned at the top, the timeline sits under it, and the result and assumptions move into a bottom sheet.",
  gdAltStudioMobile:
    "The Studio on a 390 pixel wide phone: scene at the top, timeline below, and a bar at the bottom that opens the assumptions.",
  gdSStudioMobile1: "The scene stays in view while you scrub or play.",
  gdSStudioMobile2: "The timeline, with the same controls as on desktop.",
  gdSStudioMobile3:
    "The bottom bar shows the delay and cost summary. Tap it to open the assumptions sheet.",
  gdAltStudioMobileSheet:
    "The assumptions sheet open on a phone, showing the result card and the factor controls.",
  gdSStudioMobileSheet1:
    "Tap the bar again, or press Escape, to close the sheet. Keyboard focus stays inside the sheet while it is open.",
  gdSStudioMobileSheet2: "The result card for the selected scenario.",
  gdSStudioMobileSheet3: "The same factor controls as on desktop.",

  /* Workspace */
  gdWsH: "Real work in the Workspace",
  gdWsLead:
    "The Workspace is where you use your own shipment data. Sign in with your identity provider from the Workspace page. Shipments are private to your organization. The journey is always the same six steps.",
  gdWsStepsLead: "Shipment journey",
  gdWsStep1: "Evidence: upload a temperature CSV and check the readings.",
  gdWsStep2:
    "Policy: an approved quality policy for the product, then an analysis of the evidence against it.",
  gdWsStep3: "Simulate: compare the four scenarios using engine results.",
  gdWsStep4: "Propose: pick a permitted scenario, explain why, and submit it.",
  gdWsStep5: "QA: a person with the QA role reviews the frozen evidence.",
  gdWsStep6: "Report: a PDF built from the frozen snapshot.",
  gdWsRolesP:
    "Your role decides what you can do. Admin and Logistics users can create shipments. Admin and QA users can draft policies. Only the QA role can approve a policy or record a QA review, and Admin rights alone are not enough.",

  gdWsListH: "The shipment queue",
  gdAltWsList:
    "The Shipment queue page with count cards, a search box, a status filter and a table of shipments.",
  gdSWsList1:
    "Create shipment opens the form below. If your role cannot create shipments you will see a message saying so.",
  gdSWsList2: "Search by reference or route.",
  gdSWsList3:
    "Filter by operational status. This status says where the shipment is in operations. It is not a quality judgment.",
  gdSWsList4:
    "Click a shipment reference to open it. The Latest analysis column shows only what the engine reported.",
  gdWsCreateH: "Create a shipment",
  gdAltWsCreate:
    "The Create shipment form filled in with a reference, product, origin, destination, local departure and arrival times and a cargo value.",
  gdSWsCreate1:
    "Reference. It must be unique in your organization, otherwise the form says it already exists.",
  gdSWsCreate2:
    "Product. Pick from the products your organization already has. If the list is empty, a product must be created first.",
  gdSWsCreate3:
    "Departure and arrival in your local time. Arrival has to be after departure.",
  gdSWsCreate4:
    "Cargo value in THB, not negative, with at most two decimal places.",
  gdSWsCreate5: "Create shipment. The new shipment appears in the queue.",

  gdWsEvH: "Step 1: Evidence",
  gdWsEvLead:
    "A new shipment opens on the Evidence step. The stepper at the top shows every step. A step that cannot be reached yet is marked Blocked and says why, in words, right below it.",
  gdAltWsEvidenceEmpty:
    "A new shipment: the six-step stepper with Evidence next and later steps blocked, the upload form and an empty Dataset versions panel.",
  gdSWsEvidenceEmpty1:
    "The stepper: Evidence, Policy, Simulate, Propose, QA, Report. Each step is Done, Next, Open or Blocked, with an icon as well as a label.",
  gdSWsEvidenceEmpty2:
    "The reason a step is locked. A locked step never opens, but you can still focus it and read why.",
  gdSWsEvidenceEmpty3: "The upload form for a temperature CSV.",
  gdSWsEvidenceEmpty4:
    "Dataset versions. The shipment cannot be analyzed until a dataset is ready.",
  gdAltWsUpload:
    "The upload form with a CSV chosen, column names for timestamp, temperature and sensor, a source timezone and the unit.",
  gdSWsUpload1: "Choose the CSV (up to 10 MB).",
  gdSWsUpload2:
    "Column names. Type the headers exactly as they appear in your file. The sensor column is optional.",
  gdSWsUpload3:
    "Source timezone. Required when the timestamps have no time zone of their own. Times are stored in UTC and the original is kept.",
  gdSWsUpload4: "Temperature unit in the file: C or F.",
  gdSWsUpload5:
    "Upload. The original file is kept as it is, and every upload creates a new dataset version. Earlier decisions keep the version they used.",
  gdAltWsEvidenceChart:
    "Observed temperature readings drawn as dots with a hatched grey band where the sensor record has a gap, and a legend below.",
  gdSWsEvidenceChart1:
    "Observed readings are dots. They are not joined by a line across a gap.",
  gdSWsEvidenceChart2:
    "Hatched band: an unknown interval where readings are missing. After an analysis it is counted as unknown, never as in range.",
  gdSWsEvidenceChart3:
    "The legend gives the length of each unknown interval. A table of the source readings is listed below the chart.",

  gdWsPolH: "Step 2: Policy and analysis",
  gdWsPolLead:
    "Only an approved policy can govern a simulation. Policies are versioned, move from draft to review to approved, and the approval is recorded with the QA role, a note and a time.",
  gdAltWsPolicy:
    "The Policy step before approval: the Simulate step is locked, a No approved policy notice is shown and the policy is waiting for QA.",
  gdSWsPolicy1:
    "Simulate is locked, and its reason points back to the missing policy.",
  gdSWsPolicy2:
    "With no approved policy for the product, analysis and simulation stay locked.",
  gdSWsPolicy3:
    "The policy is in Pending review. It waits for a user with the QA role to approve it.",
  gdAltWsAnalysis:
    "The analysis result: an Unknown intervals label, an explanation, 2400 seconds without readings and the matched rule R-DATA with REVIEW_REQUIRED.",
  gdSWsAnalysis1:
    "The classification. Unknown intervals means the engine could not judge some time because there were no readings.",
  gdSWsAnalysis2:
    "A plain statement of what that means. Unknown time is never treated as compliant.",
  gdSWsAnalysis3:
    "Time without readings, shown as exact seconds. Here 2400 s is the 40 minute gap.",
  gdSWsAnalysis4:
    "The rules that matched and their effect, here R-DATA with REVIEW_REQUIRED.",
  gdWsPolNote:
    "To run an analysis, choose a ready dataset and an approved policy, then press Analyze pinned evidence. The result is pinned to that exact dataset and policy.",

  gdWsSimH: "Step 3 and 4: Simulate and propose",
  gdWsSimLead:
    "The Simulate step uses the same layout as the Studio, but the numbers come from the engine. Eligibility is decided first, and only then are options compared by cost and delay.",
  gdAltWsSimulate:
    "The Simulate step: scenario list with engine statuses, the route scene, the result card with Insufficient data or Review required, the observed readings chart and a comparison table.",
  gdSWsSimulate1:
    "Each scenario now carries an engine status badge, such as Insufficient data or Review required.",
  gdSWsSimulate2: "The schematic route scene, the same as in the Studio.",
  gdSWsSimulate3:
    "Result card. Engine direct cost is marked Calculated. The reasons list the rules behind the status, and missing evidence is named.",
  gdSWsSimulate4:
    "The comparison table lists every scenario with its status, cost and delay. Ranking shows Excluded where the engine does not rank an option.",
  gdSWsSimulate5:
    "Prepare proposal takes the selected scenario to the Propose step. That step opens only for a scenario that is eligible or needs review.",
  gdWsSimNote:
    "Changing delay, cost or receiver assumptions recalculates a preview. Saving makes a new run, and the earlier run is never overwritten. A Blocked scenario cannot be proposed, and an Insufficient data scenario needs more evidence first.",
  gdAltWsPropose:
    "The proposal form for Hold for inspection with its Review required status, the rule reasons, a justification box and a Save draft for review button.",
  gdSWsPropose1: "The scenario you chose, with its engine status and cost.",
  gdSWsPropose2:
    "The reasons: every rule that was checked, its effect and whether it matched.",
  gdSWsPropose3: "Explain why this is the appropriate action.",
  gdSWsPropose4:
    "Save draft for review. Submit to QA comes next, and only the user who wrote the draft can submit it. Submitting freezes the evidence.",

  gdWsQaH: "Step 5 and 6: QA review and report",
  gdWsQaLead:
    "After submission, the evidence is a frozen snapshot: dataset hash, policy version, engine and template versions and the selected scenario. Later changes to the policy or the data cannot alter it.",
  gdAltWsQa:
    "The QA review step: the decision waiting for QA, its frozen snapshot, and the review form with an outcome, notes, a confirmation tick and a Confirm review outcome button.",
  gdSWsQa1:
    "The frozen snapshot. It is read-only and shows hashes and versions.",
  gdSWsQa2:
    "Review outcome: Request changes, Reject proposal or Approve internal workflow. This is a QA-only choice.",
  gdSWsQa3: "Review notes are recorded with the outcome.",
  gdSWsQa4:
    "Confirm review outcome. It records your role, notes, the evidence references and the time.",
  gdWsQaNote:
    "A person without the QA role sees the proposal but no review actions, and the server enforces that. A proposer cannot approve their own proposal. A scenario blocked by the policy stays blocked. QA approval records the internal workflow outcome only.",
  gdAltWsReport:
    "The Report step after approval: the frozen snapshot, a Refresh report status button and a Download PDF button.",
  gdSWsReport1:
    "The report is built from this snapshot and from nothing newer.",
  gdSWsReport2:
    "After you press Generate PDF report, refresh the status until it is ready.",
  gdSWsReport3:
    "Download PDF. The labels in the PDF follow the interface language, English or Thai. The snapshot data is the same in both.",
  gdWsExplainP:
    "An optional written explanation can be generated for a run. It is text that explains the engine result. It is not a computed value and it never changes eligibility.",

  /* FAQ */
  gdFaqH: "Questions and fixes",
  gdFaq1Q: "The 3D scene is blank or says 3D is unavailable.",
  gdFaq1A:
    "The browser could not create a WebGL context. The Studio then switches to the 2D view, which has the same scenarios and evidence. You can also pick 2D yourself from the camera buttons.",
  gdFaq2Q: "Play does nothing and the scene jumps to the end.",
  gdFaq2A:
    "Your system asks for reduced motion. The Studio then shows the final frame and turns off Play. Use the timeline slider to move through the journey instead.",
  gdFaq3Q: "A keyboard shortcut does not work.",
  gdFaq3A:
    "Shortcuts are ignored while you type in a field. Space also leaves alone a button or link that has focus. Click an empty part of the page and try again.",
  gdFaq4Q: "The coach mark and the autoplay are gone.",
  gdFaq4A:
    "Your browser remembers that you have seen them. Clear the site data for this page to see the first-visit tour again, or press Reset.",
  gdFaq5Q: "Why does every option say Not evaluated in the Studio?",
  gdFaq5A:
    "The Studio is a sandbox. It has no policy and no engine run, so it cannot decide eligibility. Use the Workspace for engine results.",
  gdFaq6Q: "Can I upload my own CSV in the Studio?",
  gdFaq6A:
    "No. Uploading happens in the Workspace, on a shipment's Evidence step.",
  gdFaq7Q: "Why is there a gap instead of a line?",
  gdFaq7A:
    "A period with no readings is unknown. The app never fills it in or counts it as in range.",
  gdFaq8Q: "Sign-in does not work or my session ended.",
  gdFaq8A:
    "Use the Sign in with identity provider button on the Workspace page, from the same address you opened the app on. If a page says your session has ended, sign in again. If it says your role cannot open something, ask an administrator of your organization to change your role.",
  gdFaq9Q: "A step is locked. What do I do?",
  gdFaq9A:
    "Read the reason under the step. Typical reasons are a missing ready dataset, no approved policy, no completed analysis, no saved simulation run or no submitted proposal. Complete that earlier step and the lock lifts.",
  gdFaq10Q: "Can I switch the language or theme?",
  gdFaq10A:
    "Yes. Use EN and ไทย and the Light or Dark button in the header. The choice is remembered in your browser, and this guide and its screenshots follow it.",

  /* Safety */
  gdSafeH: "What this tool does not do",
  gdSafeP1:
    "Cold Chain Simulation Studio helps people weigh options after a temperature problem. It does not tell you that cargo may be sold, shipped on or thrown away.",
  gdSafeP2:
    "Whether an option can go ahead is decided only by the engine, applying an approved and versioned policy, and then by a person with the QA role who records their decision. A low cost, a short delay or a calm-looking chart never changes that.",
  gdSafeP3:
    "Studio figures are demo estimates. The temperature limits in the screenshots are test values and must not be used as real limits for any product.",
} as const;

export const guideTh: Record<keyof typeof guideEn, string> = {
  navGuide: "คู่มือ",
  gdTitle: "วิธีใช้ Cold Chain Simulation Studio",
  gdLead:
    "คู่มือแบบภาพสำหรับสตูดิโอและพื้นที่ทำงาน ภาพหน้าจอทุกภาพมาจากแอปที่ใช้งานจริง และหมายเลขบนภาพตรงกับขั้นตอนที่มีหมายเลขเดียวกันข้างภาพ",
  gdToc: "ในหน้านี้",
  gdTocToggle: "สารบัญ",
  gdHowTo: "วิธีใช้",
  gdEnlarge: "ขยายภาพหน้าจอ",
  gdClose: "ปิด",
  gdStepsLabel: "ขั้นตอนตามหมายเลขของภาพหน้าจอ",
  gdTryStudio: "เปิดสตูดิโอ",
  gdTryWorkspace: "เปิดพื้นที่ทำงาน",
  gdDemoNote:
    "สตูดิโอใช้ข้อมูลสมมติเพื่อสาธิต ภาพหน้าจอของพื้นที่ทำงานก็ใช้ข้อมูลสังเคราะห์เช่นกัน",

  gdTocQuick: "เริ่มต้นใช้งาน",
  gdTocTour: "ทัวร์หน้าสตูดิโอ",
  gdTocPlayback: "การเล่นย้อนดู",
  gdTocHonest: "อ่านข้อมูลอย่างตรงไปตรงมา",
  gdTocScenarios: "สถานการณ์และการลองสมมติ",
  gdTocKeys: "ปุ่มลัดบนคีย์บอร์ด",
  gdTocMobile: "บนมือถือ",
  gdTocWorkspace: "งานจริงในพื้นที่ทำงาน",
  gdTocWsList: "การจัดส่ง",
  gdTocWsEvidence: "หลักฐาน",
  gdTocWsPolicy: "นโยบายและการวิเคราะห์",
  gdTocWsSim: "จำลองและเสนอ",
  gdTocWsQa: "การทบทวนโดย QA และรายงาน",
  gdTocFaq: "คำถามและวิธีแก้",
  gdTocSafety: "สิ่งที่เครื่องมือนี้ไม่ทำ",

  gdQuickH: "เริ่มต้นใช้งาน",
  gdQuickLead:
    "เปิดสตูดิโอจากแถบด้านบน คุณจะเห็น DEMO-001 ซึ่งเป็นการขนส่งสตรอว์เบอร์รีจากเชียงใหม่ไปกรุงเทพฯ ที่อุณหภูมิสูงขึ้นระหว่างทาง",
  gdQuickP1:
    "เมื่อเข้าครั้งแรก รถจะวิ่งตลอดเส้นทางเองประมาณ 8 วินาทีแล้วหยุดที่จุดตัดสินใจ การเข้าครั้งต่อไปจะเริ่มที่จุดนั้นเลย ปุ่มรีเซ็ต (หรือกด R) จะเล่นเส้นทางใหม่ตั้งแต่ต้น",
  gdQuickP2:
    "เลือกหนึ่งในสี่สถานการณ์ แล้วรถจะวิ่งตามเส้นทางนั้น สิ่งที่คุณทำในสตูดิโอจะไม่ถูกบันทึกหรือส่งไปที่ใด",
  gdAltStudioFirst:
    "สตูดิโอเมื่อเข้าครั้งแรก มีรายการสถานการณ์ทางซ้าย ฉากจำลอง 3 มิติตรงกลางพร้อมคำแนะนำ การ์ดผลลัพธ์ทางขวา และไทม์ไลน์ด้านล่าง",
  gdSStudioFirst1:
    "คำแนะนำจะปรากฏครั้งเดียวเมื่อรถถึงจุดตัดสินใจ กดเข้าใจแล้วเพื่อปิด หรือเลือกสถานการณ์ได้เลย",
  gdSStudioFirst2: "สี่สถานการณ์ คลิกเลือก หรือกดปุ่ม 1 ถึง 4 บนคีย์บอร์ด",
  gdSStudioFirst3:
    "ฉากจำลอง รถหยุดที่จุดตัดสินใจ และกล่องสินค้าเรืองสีตามอุณหภูมิในขณะนั้น",
  gdSStudioFirst4:
    "การ์ดผลลัพธ์ของสถานการณ์ที่เลือก แสดงความล่าช้า ค่าใช้จ่าย สมมติฐานของผู้รับ และความเข้าเกณฑ์",
  gdSStudioFirst5:
    "ไทม์ไลน์ ตัวชี้อยู่ที่จุดตัดสินใจ ซึ่งเป็นช่วงท้ายของการเดินทางที่บันทึกไว้",

  gdTourH: "ทัวร์หน้าสตูดิโอ",
  gdTourLead:
    "สตูดิโอมีหน้าที่เดียว คือแสดงว่าสินค้าเจออะไรมา มีทางเลือกอะไรบ้าง และแต่ละทางเลือกมีต้นทุนเท่าไร หน้าจอแบ่งเป็นห้าส่วน",
  gdAltStudioOverview:
    "สตูดิโอที่ความกว้าง 1440 พิกเซล มีหกส่วนตามหมายเลข ได้แก่ ส่วนหัวการจัดส่ง รายการสถานการณ์ ฉากจำลอง 3 มิติ การ์ดผลลัพธ์ แผงสมมติฐาน และไทม์ไลน์",
  gdSStudioOverview1:
    "ส่วนหัวการจัดส่ง ใช้ตัวเลือกเพื่อสลับระหว่าง DEMO-001, DEMO-002 และ DEMO-003 ป้ายข้อมูลจำลองเพื่อสาธิตเท่านั้นแสดงอยู่เสมอ",
  gdSStudioOverview2:
    "รายการสถานการณ์พร้อมความล่าช้าและค่าใช้จ่ายของแต่ละทางเลือก ป้ายตัวอย่างที่เน้นใช้เน้นหนึ่งทางเลือกเพื่อการสาธิต ไม่ใช่การตัดสินตามนโยบาย",
  gdSStudioOverview3:
    "ฉากจำลอง เป็นแผนผัง ไม่ใช่แผนที่ GPS ปุ่มในฉากใช้เปลี่ยนมุมกล้องและเปิดโหมดเปรียบเทียบ",
  gdSStudioOverview4:
    "การ์ดผลลัพธ์ แสดงความล่าช้าเพิ่มเติม ค่าใช้จ่ายโดยตรง สมมติฐานการยอมรับของผู้รับ และความเข้าเกณฑ์",
  gdSStudioOverview5:
    "ปรับสมมติฐาน มีแท็บความล่าช้า ค่าใช้จ่าย ผู้รับ และขั้นสูง ผลลัพธ์จะเปลี่ยนทันทีที่คุณแก้ค่า",
  gdSStudioOverview6:
    "ไทม์ไลน์สำหรับเลื่อนดู แสดงอุณหภูมิตลอดการเดินทาง พร้อมปุ่มเล่น หยุด และความเร็ว",
  gdTourNote:
    "ใต้ไทม์ไลน์ยังมีแถบหลักฐานอุณหภูมิ (จำนวนค่าอ่าน ช่วงอุณหภูมิ และตารางค่าอ่านทั้งหมด) และตัวอย่างการเตรียมข้อเสนอ ซึ่งไม่บันทึกอะไรเลย ข้อเสนอจริงทำในพื้นที่ทำงาน",

  gdPlayH: "การเล่นย้อนดู",
  gdPlayLead:
    "ไทม์ไลน์ควบคุมทั้งฉาก รถ ริบบิ้นที่ลากตามหลัง และตัวเลขที่แสดง ล้วนเดินตามนาฬิกาเดียวกัน",
  gdAltStudioTimeline:
    "ภาพขยายแถบไทม์ไลน์ มีปุ่มเล่น ปุ่มความเร็ว คำอธิบายสี แถบแสดงอุณหภูมิ และเครื่องหมายจุดตัดสินใจ",
  gdSStudioTimeline1:
    "ปุ่มเล่น หยุดชั่วคราว หรือเล่นซ้ำ กด Space ได้ผลเหมือนกันเมื่อไม่มีปุ่มใดถูกโฟกัสอยู่",
  gdSStudioTimeline2:
    "ความเร็ว 0.5x, 1x หรือ 2x ค่าที่เลือกจะคงอยู่ตลอดการใช้งาน",
  gdSStudioTimeline3:
    "คำอธิบายสี เย็นกว่า อุ่นกว่า และไม่ทราบ สเกลนี้ใช้แสดงผลเท่านั้น ไม่ใช่เกณฑ์จำกัด",
  gdSStudioTimeline4:
    "แถบแสดงเวลา ลากหรือคลิกเพื่อเลื่อนไปยังจุดใดก็ได้ เมื่อโฟกัสที่แถบ ลูกศรซ้ายและขวาจะเลื่อนครั้งละ 5 นาที และกด Shift ร่วมด้วยจะเลื่อนครั้งละ 30 นาที",
  gdSStudioTimeline5:
    "เครื่องหมายจุดตัดสินใจ การเล่นจะหยุดเองที่นี่ ทางขวาคือช่วงการดำเนินตามสถานการณ์ ซึ่งจะถูกวาดหลังจากคุณเลือกทางเลือก",
  gdPlayNote:
    "ค่าอ่านแต่ละค่าจะคงอยู่จนกว่าจะมีค่าถัดไป กราฟจึงเป็นแบบขั้นบันได ไม่ใช่เส้นโค้งเรียบ เพราะสตูดิโอไม่สร้างอุณหภูมิขึ้นเองระหว่างค่าอ่าน",

  gdHonestH: "อ่านข้อมูลอย่างตรงไปตรงมา",
  gdHonestLead:
    "สตูดิโอออกแบบให้หลักฐานที่ขาดหายมองเห็นได้ชัด เมื่อเข้าใจสัญญาณทั้งสี่นี้ คุณจะอ่านทุกหน้าจอในแอปได้",
  gdAltStudioGap:
    "DEMO-003 ที่หยุดอยู่ในช่วงที่เซนเซอร์ไม่มีข้อมูล ฉากแสดงป้ายไม่มีค่าอ่าน 09:30–10:30 ตัวเลขแสดงว่าไม่ทราบ และไทม์ไลน์มีแถบลายเส้นเฉียง",
  gdSStudioGap1:
    "ช่วงที่บันทึกจากเซนเซอร์ขาดหาย ริบบิ้นหยุด รถเปลี่ยนเป็นสีเทา และป้ายไม่มีค่าอ่านบอกช่วงเวลาที่หายไป",
  gdSStudioGap2:
    "ตัวเลขแสดงคำว่าไม่ทราบพร้อมลายเส้นเฉียง ไม่ใช่อุณหภูมิที่เดาขึ้นมา",
  gdSStudioGap3:
    "บนไทม์ไลน์ ช่วงเวลาเดียวกันเป็นลายเส้นเฉียงสีเทา ไม่มีเส้นลากผ่าน",
  gdHonestGapP:
    "ลองดู เลือก DEMO-003 ในตัวเลือก แล้วลากไทม์ไลน์ไปที่ช่วง 09:30 ถึง 10:30 ช่วงที่ขาดคือเวลาที่ไม่ทราบ ระบบไม่เติมข้อมูลให้และไม่นับว่าอยู่ในเกณฑ์",
  gdAltRefThermal:
    "สเกลสีอุณหภูมิจากน้ำเงินเย็น ฟ้าอ่อน อำพัน ไปจนถึงแดงส้ม และตัวอย่างลายเส้นเฉียงสีเทาที่ใช้กับข้อมูลที่ไม่ทราบ",
  gdSRefThermal1:
    "สเกลอุณหภูมิ น้ำเงินเย็น ฟ้าอ่อน อำพัน แดงส้ม ใช้สีกับข้อมูลอุณหภูมิเท่านั้น",
  gdSRefThermal2:
    "ลายเส้นเฉียงสีเทาหมายถึงไม่ทราบหรือไม่มีค่าอ่านเสมอ ทั้งในกราฟ ฉาก 3 มิติ และป้ายสถานะ",
  gdAltRefStatus:
    "ป้ายสถานะทั้งห้าแบบและป้ายแหล่งที่มาทั้งสี่แบบตามที่ปรากฏในแอป",
  gdSRefStatus1:
    "ป้ายสถานะ แต่ละป้ายมีรูปทรงไอคอนและข้อความ จึงไม่ต้องพึ่งสีเพียงอย่างเดียว",
  gdSRefStatus2: "ป้ายแหล่งที่มา วางไว้ข้างตัวเลขเพื่อบอกว่าค่านั้นมาจากไหน",
  gdStatusH: "ป้ายสถานะ",
  gdStatusColStatus: "ป้าย",
  gdStatusColMeaning: "ความหมาย",
  gdStEligible:
    "เอนจินไม่พบกฎที่บล็อกหรือหยุดทางเลือกนี้ภายใต้นโยบายที่อนุมัติแล้ว แต่ยังเป็นเรื่องที่คนต้องตัดสิน ไม่ใช่การอนุญาต",
  gdStReview: "มีกฎที่ต้องให้คนตรวจดูหลักฐานก่อน ทางเลือกนี้จึงจะดำเนินต่อได้",
  gdStBlocked:
    "กฎขั้นเด็ดขาดในนโยบายตัดทางเลือกนี้ออก ต้นทุน ความล่าช้า น้ำหนักคะแนน หรือบันทึกการทบทวนก็เปลี่ยนไม่ได้",
  gdStInsufficient:
    "หลักฐานไม่พอจะประเมินทางเลือกนี้ เช่น ค่าอ่านมีช่วงขาดหาย ให้เพิ่มหลักฐานที่ขาดแล้วคำนวณใหม่",
  gdStNotEvaluated:
    "ยังไม่มีผลรันจากเอนจิน สตูดิโอแสดงสถานะนี้เสมอเพราะเป็นตัวอย่างสาธิต",
  gdProvH: "ป้ายแหล่งที่มา",
  gdProvColChip: "ป้าย",
  gdProvColMeaning: "ตัวเลขนี้มาจากไหน",
  gdPvObserved: "วัดโดยเซนเซอร์และบันทึกอยู่ในข้อมูล",
  gdPvEntered:
    "ผู้ใช้พิมพ์หรือแก้ไขเอง สมมติฐานที่แก้ไขแล้วถือเป็นค่าประมาณของผู้ใช้",
  gdPvCalculated: "เอนจินคำนวณจากค่าที่วัดได้และค่าที่ผู้ใช้กรอก",
  gdPvEstimated:
    "ค่าประมาณที่เตรียมไว้และยังไม่มีใครยืนยัน ตัวเลขในการสาธิตเป็นแบบนี้",

  gdScenH: "สถานการณ์ การลองสมมติ และมุมกล้อง",
  gdScenLead:
    "เมื่อเลือกสถานการณ์ รถจะวิ่งไปตามเส้นทางนั้น นาฬิกาความล่าช้าและตัวนับค่าใช้จ่ายจะเดินขึ้นจนถึงยอดรวมที่ถูกต้องของทางเลือกนั้น",
  gdAltStudioScenario:
    "กักไว้เพื่อตรวจสอบหลังจบการเดินตามสถานการณ์ สถานการณ์ที่เลือกถูกเน้น นาฬิกาความล่าช้าและตัวนับค่าใช้จ่ายแสดงยอดรวม และการ์ดผลลัพธ์อัปเดตแล้ว",
  gdSStudioScenario1:
    "สถานการณ์ที่เลือกจะถูกเน้น สลับได้ด้วยการคลิกหรือกดปุ่ม 1 ถึง 4",
  gdSStudioScenario2:
    "นาฬิกาความล่าช้าและตัวนับค่าใช้จ่ายของเส้นทางที่เลือก จะหยุดที่ยอดรวมที่ถูกต้องเป๊ะ ถึงหลักสตางค์",
  gdSStudioScenario3:
    "การ์ดผลลัพธ์ตามการเลือก ตัวเลขมีป้ายแหล่งที่มากำกับ และความเข้าเกณฑ์ยังเป็นยังไม่ได้ประเมินในการสาธิต",
  gdSStudioScenario4:
    "ป้ายเวลาแสดงเวลาในสถานการณ์และระบุว่าไม่ทราบ หลังค่าอ่านสุดท้ายสตูดิโอไม่มีแบบจำลองอุณหภูมิ จึงไม่แสดงอุณหภูมิ",
  gdWhatIfH: "เปลี่ยนปัจจัยแล้วดูผลสมมติ",
  gdWhatIfLead:
    "เปิดแผงปรับสมมติฐานเพื่อเปลี่ยนความล่าช้า องค์ประกอบค่าใช้จ่าย หรือสมมติฐานของผู้รับ หรือกดป้ายตัวอย่างเพื่อลองแบบคลิกเดียว หลังเปลี่ยนค่า ภาพเงาของค่าก่อนหน้าจะค้างไว้ราวหนึ่งวินาที เพื่อให้เห็นว่าอะไรเปลี่ยนไป",
  gdAltStudioFactors:
    "หลังเปลี่ยนความล่าช้าเป็น 240 นาที มีป้ายตัวอย่างเหนือฉาก ป้ายก่อนหน้าที่แสดงค่าเดิม แท็บปัจจัย ช่องความล่าช้า และผลลัพธ์พร้อมบรรทัดค่าตั้งต้น",
  gdSStudioFactors1:
    "ป้ายตัวอย่าง ถ้าตรวจสอบใช้เวลา 4 ชม.? ตั้งความล่าช้าของการกักเป็น 240 นาที ถ้าผู้รับรายใหม่ปฏิเสธ? สมมติว่าปฏิเสธในทางเลือกเปลี่ยนเส้นทาง ทั้งสองแบบจะเล่นเส้นทางซ้ำ",
  gdSStudioFactors2:
    "ป้ายภาพเงา แสดงความล่าช้าและค่าใช้จ่ายก่อนที่คุณจะเปลี่ยน และจางหายไปหลังประมาณหนึ่งวินาที",
  gdSStudioFactors3:
    "แท็บปัจจัย ความล่าช้า ค่าใช้จ่าย ผู้รับ ขั้นสูง แท็บขั้นสูงเก็บน้ำหนักการจัดอันดับ ซึ่งมีผลต่อการจัดอันดับเท่านั้น ไม่กระทบหลักฐานหรือความเข้าเกณฑ์",
  gdSStudioFactors4:
    "พิมพ์ค่าหรือเลื่อนแถบ ค่าที่ไม่ถูกต้องจะมีข้อความเตือนที่ช่องนั้นและจะไม่ถูกนำไปใช้",
  gdSStudioFactors5:
    "การ์ดผลลัพธ์มีบรรทัดค่าตั้งต้น ทำให้เห็นส่วนต่าง ตัวเลขที่ถูกแก้จะเปลี่ยนป้ายจากประมาณการเป็นผู้ใช้กรอก ปุ่มรีเซ็ตเป็นค่าตั้งต้นจะยกเลิกสิ่งที่แก้",
  gdCompareH: "โหมดเปรียบเทียบ",
  gdCompareLead:
    "กด C หรือปุ่มเปรียบเทียบเพื่อรันทั้งสี่สถานการณ์เคียงกันบนนาฬิกาเดียวกัน รถแต่ละคันมีหมายเลขสถานการณ์กำกับ",
  gdAltStudioCompare:
    "โหมดเปรียบเทียบ รถสี่คันหมายเลข 1 ถึง 4 วิ่งตามเส้นทางของตนพร้อมกัน",
  gdSStudioCompare1: "ปุ่มเปรียบเทียบ กดซ้ำหรือกด C เพื่อออกจากโหมดนี้",
  gdSStudioCompare2:
    "รถเงาสี่คน แต่ละคันมีหมายเลขสถานการณ์ วิ่งบนสเกลเวลาเดียวกัน",
  gdSStudioCompare3:
    "ไทม์ไลน์เล่นช่วงการดำเนินตามสถานการณ์ซ้ำ เวลาในสถานการณ์เป็นแบบแผนผังและไม่มีค่าอ่าน",
  gdCameraH: "มุมกล้องและการรีเซ็ต",
  gdCameraLead:
    "ภาพรวมเป็นมุมไอโซเมตริกตั้งต้น ตามรถจะให้รถอยู่ในกรอบเสมอ ส่วน 2D เป็นแผนผังมองจากด้านบนที่ให้ข้อมูลเท่ากัน และเป็นมุมมองที่ระบบสลับให้อัตโนมัติเมื่อเบราว์เซอร์แสดง 3 มิติไม่ได้",
  gdAltStudio2d:
    "แผนผัง 2D มองจากด้านบนของสถานการณ์เดียวกัน มีปุ่มมุมกล้องอยู่ด้านบน",
  gdSStudio2d1: "ปุ่มมุมกล้อง ภาพรวม ตามรถ และ 2D",
  gdSStudio2d2:
    "มุมมอง 2D แสดงเส้นทาง ป้ายชื่อ และสถานะสถานการณ์เหมือนฉาก 3 มิติ",
  gdResetP:
    "ปุ่มรีเซ็ต (หรือ R) คืนปัจจัยเป็นค่าที่เตรียมไว้ ออกจากโหมดเปรียบเทียบ และเล่นเส้นทางใหม่ตั้งแต่ต้น",

  gdKeysH: "ปุ่มลัดบนคีย์บอร์ด",
  gdKeysLead:
    "ปุ่มลัดใช้ได้ทั่วหน้าสตูดิโอ ยกเว้นขณะพิมพ์ในช่องกรอกข้อมูล Space จะไม่ทำงานเป็นปุ่มเล่นเมื่อมีปุ่มหรือลิงก์ถูกโฟกัสอยู่ เพราะจะไปกดปุ่มหรือลิงก์นั้นแทน",
  gdKeyCol: "ปุ่ม",
  gdKeyDoes: "ทำอะไร",
  gdKeySpace: "เล่นหรือหยุดชั่วคราว",
  gdKeyArrows: "เลื่อนตัวชี้เวลาถอยหลังหรือไปข้างหน้า 5 นาที",
  gdKeyShiftArrows: "เลื่อนตัวชี้เวลาถอยหลังหรือไปข้างหน้า 30 นาที",
  gdKeyC: "เปิดหรือปิดโหมดเปรียบเทียบ",
  gdKeyR: "รีเซ็ต",
  gdKey14: "เลือกสถานการณ์ที่ 1 ถึง 4",
  gdKeyEsc: "ปิดคำแนะนำ หรือปิดแผ่นสมมติฐานบนมือถือ",

  gdMobileH: "บนมือถือ",
  gdMobileLead:
    "บนหน้าจอแคบ (760 พิกเซลหรือน้อยกว่า) ฉาก 3 มิติจะตรึงอยู่ด้านบน ไทม์ไลน์อยู่ใต้ฉาก ส่วนผลลัพธ์และสมมติฐานย้ายไปอยู่ในแผ่นที่เลื่อนขึ้นจากด้านล่าง",
  gdAltStudioMobile:
    "สตูดิโอบนมือถือกว้าง 390 พิกเซล ฉากอยู่ด้านบน ไทม์ไลน์อยู่ใต้ฉาก และมีแถบด้านล่างสำหรับเปิดสมมติฐาน",
  gdSStudioMobile1: "ฉากอยู่ในสายตาตลอดขณะเลื่อนหรือเล่น",
  gdSStudioMobile2: "ไทม์ไลน์ มีปุ่มควบคุมเหมือนบนเดสก์ท็อป",
  gdSStudioMobile3:
    "แถบด้านล่างแสดงสรุปความล่าช้าและค่าใช้จ่าย แตะเพื่อเปิดแผ่นสมมติฐาน",
  gdAltStudioMobileSheet:
    "แผ่นสมมติฐานที่เปิดอยู่บนมือถือ แสดงการ์ดผลลัพธ์และตัวควบคุมปัจจัย",
  gdSStudioMobileSheet1:
    "แตะแถบอีกครั้งหรือกด Escape เพื่อปิดแผ่น ขณะเปิดอยู่ โฟกัสของคีย์บอร์ดจะวนอยู่ภายในแผ่น",
  gdSStudioMobileSheet2: "การ์ดผลลัพธ์ของสถานการณ์ที่เลือก",
  gdSStudioMobileSheet3: "ตัวควบคุมปัจจัยชุดเดียวกับบนเดสก์ท็อป",

  gdWsH: "งานจริงในพื้นที่ทำงาน",
  gdWsLead:
    "พื้นที่ทำงานคือที่ที่คุณใช้ข้อมูลการจัดส่งของคุณเอง ลงชื่อเข้าใช้ด้วยผู้ให้บริการยืนยันตัวตนจากหน้าพื้นที่ทำงาน การจัดส่งเป็นข้อมูลส่วนตัวของหน่วยงานคุณ และเส้นทางงานมีหกขั้นตอนเหมือนกันทุกครั้ง",
  gdWsStepsLead: "เส้นทางของการจัดส่ง",
  gdWsStep1: "หลักฐาน อัปโหลด CSV อุณหภูมิและตรวจค่าอ่าน",
  gdWsStep2:
    "นโยบาย ต้องมีนโยบายคุณภาพที่อนุมัติแล้วสำหรับสินค้า จากนั้นวิเคราะห์หลักฐานตามนโยบายนั้น",
  gdWsStep3: "จำลอง เปรียบเทียบสี่สถานการณ์ด้วยผลจากเอนจิน",
  gdWsStep4: "เสนอ เลือกสถานการณ์ที่อนุญาต อธิบายเหตุผล แล้วส่งเสนอ",
  gdWsStep5: "QA ผู้ที่มีบทบาท QA ทบทวนหลักฐานที่ถูกล็อกไว้",
  gdWsStep6: "รายงาน ไฟล์ PDF ที่สร้างจากสแนปช็อตที่ล็อกไว้",
  gdWsRolesP:
    "สิ่งที่ทำได้ขึ้นกับบทบาทของคุณ ผู้ดูแลระบบและฝ่ายโลจิสติกส์สร้างการจัดส่งได้ ผู้ดูแลระบบและ QA ร่างนโยบายได้ มีเพียงบทบาท QA เท่านั้นที่อนุมัตินโยบายหรือบันทึกผลทบทวนของ QA ได้ สิทธิ์ผู้ดูแลระบบอย่างเดียวไม่พอ",

  gdWsListH: "คิวการจัดส่ง",
  gdAltWsList:
    "หน้าคิวการจัดส่ง มีการ์ดสรุปจำนวน ช่องค้นหา ตัวกรองสถานะ และตารางการจัดส่ง",
  gdSWsList1:
    "ปุ่มสร้างการจัดส่งเปิดแบบฟอร์มด้านล่าง หากบทบาทของคุณสร้างไม่ได้ ระบบจะแจ้งไว้",
  gdSWsList2: "ค้นหาด้วยรหัสอ้างอิงหรือเส้นทาง",
  gdSWsList3:
    "กรองตามสถานะการดำเนินงาน สถานะนี้บอกว่าการจัดส่งอยู่ขั้นไหนในการปฏิบัติงาน ไม่ใช่การประเมินคุณภาพ",
  gdSWsList4:
    "คลิกรหัสอ้างอิงเพื่อเปิดการจัดส่ง คอลัมน์การวิเคราะห์ล่าสุดแสดงเฉพาะสิ่งที่เอนจินรายงาน",
  gdWsCreateH: "สร้างการจัดส่ง",
  gdAltWsCreate:
    "แบบฟอร์มสร้างการจัดส่งที่กรอกรหัสอ้างอิง สินค้า ต้นทาง ปลายทาง เวลาออกเดินทางและมาถึงตามเวลาท้องถิ่น และมูลค่าสินค้า",
  gdSWsCreate1:
    "รหัสอ้างอิง ต้องไม่ซ้ำกันในหน่วยงานของคุณ ถ้าซ้ำ แบบฟอร์มจะแจ้งว่ามีอยู่แล้ว",
  gdSWsCreate2:
    "สินค้า เลือกจากสินค้าที่หน่วยงานของคุณมีอยู่ ถ้ารายการว่าง ต้องสร้างสินค้าก่อน",
  gdSWsCreate3:
    "เวลาออกเดินทางและมาถึงตามเวลาท้องถิ่นของคุณ เวลามาถึงต้องหลังเวลาออกเดินทาง",
  gdSWsCreate4: "มูลค่าสินค้าเป็นบาท ห้ามติดลบ และมีทศนิยมได้ไม่เกินสองตำแหน่ง",
  gdSWsCreate5: "สร้างการจัดส่ง การจัดส่งใหม่จะปรากฏในคิว",

  gdWsEvH: "ขั้นที่ 1 หลักฐาน",
  gdWsEvLead:
    "การจัดส่งใหม่จะเปิดที่ขั้นหลักฐาน แถบขั้นตอนด้านบนแสดงครบทุกขั้น ขั้นที่ยังเข้าไม่ได้จะมีป้ายถูกบล็อกและบอกเหตุผลเป็นข้อความอยู่ใต้ขั้นนั้น",
  gdAltWsEvidenceEmpty:
    "การจัดส่งใหม่ แถบหกขั้นตอนโดยขั้นหลักฐานเป็นขั้นถัดไปและขั้นหลังจากนั้นถูกบล็อก มีแบบฟอร์มอัปโหลด และแผงเวอร์ชันชุดข้อมูลที่ยังว่าง",
  gdSWsEvidenceEmpty1:
    "แถบขั้นตอน หลักฐาน นโยบาย จำลอง เสนอ QA รายงาน แต่ละขั้นเป็นเสร็จแล้ว ขั้นถัดไป เปิดอยู่ หรือถูกบล็อก มีทั้งไอคอนและข้อความ",
  gdSWsEvidenceEmpty2:
    "เหตุผลที่ขั้นนั้นถูกล็อก ขั้นที่ล็อกจะไม่เปิด แต่ยังโฟกัสเพื่ออ่านเหตุผลได้",
  gdSWsEvidenceEmpty3: "แบบฟอร์มอัปโหลด CSV อุณหภูมิ",
  gdSWsEvidenceEmpty4:
    "เวอร์ชันชุดข้อมูล ยังวิเคราะห์การจัดส่งไม่ได้จนกว่าจะมีชุดข้อมูลที่พร้อมใช้",
  gdAltWsUpload:
    "แบบฟอร์มอัปโหลดที่เลือกไฟล์ CSV แล้ว มีชื่อคอลัมน์เวลา อุณหภูมิ และเซนเซอร์ เขตเวลาของข้อมูลต้นทาง และหน่วย",
  gdSWsUpload1: "เลือกไฟล์ CSV (ไม่เกิน 10 MB)",
  gdSWsUpload2:
    "ชื่อคอลัมน์ พิมพ์ชื่อหัวคอลัมน์ให้ตรงกับในไฟล์ คอลัมน์เซนเซอร์ไม่บังคับ",
  gdSWsUpload3:
    "เขตเวลาของข้อมูลต้นทาง จำเป็นเมื่อเวลาในไฟล์ไม่ระบุเขตเวลา ระบบเก็บเวลาเป็น UTC และเก็บค่าเดิมไว้ด้วย",
  gdSWsUpload4: "หน่วยอุณหภูมิในไฟล์ C หรือ F",
  gdSWsUpload5:
    "อัปโหลด ไฟล์ต้นฉบับถูกเก็บไว้ไม่เปลี่ยนแปลง และทุกครั้งที่อัปโหลดจะได้ชุดข้อมูลเวอร์ชันใหม่ การตัดสินใจก่อนหน้ายังคงใช้เวอร์ชันเดิม",
  gdAltWsEvidenceChart:
    "ค่าอุณหภูมิที่วัดได้วาดเป็นจุด มีแถบลายเส้นเฉียงสีเทาตรงช่วงที่เซนเซอร์ขาดข้อมูล และมีคำอธิบายสัญลักษณ์ด้านล่าง",
  gdSWsEvidenceChart1: "ค่าที่วัดได้เป็นจุด ไม่มีเส้นเชื่อมข้ามช่วงที่ขาด",
  gdSWsEvidenceChart2:
    "แถบลายเส้นเฉียง คือช่วงที่ไม่ทราบเพราะไม่มีค่าอ่าน หลังวิเคราะห์แล้วจะนับเป็นไม่ทราบ ไม่นับว่าอยู่ในเกณฑ์",
  gdSWsEvidenceChart3:
    "คำอธิบายสัญลักษณ์บอกความยาวของแต่ละช่วงที่ไม่ทราบ ตารางค่าอ่านต้นฉบับอยู่ใต้กราฟ",

  gdWsPolH: "ขั้นที่ 2 นโยบายและการวิเคราะห์",
  gdWsPolLead:
    "มีเพียงนโยบายที่อนุมัติแล้วเท่านั้นที่ใช้กำกับการจำลองได้ นโยบายมีเวอร์ชัน เดินจากฉบับร่างไปสู่การทบทวนและอนุมัติ และการอนุมัติจะบันทึกบทบาท QA บันทึกข้อความ และเวลา",
  gdAltWsPolicy:
    "ขั้นนโยบายก่อนอนุมัติ ขั้นจำลองถูกล็อก มีประกาศว่าไม่มีนโยบายที่อนุมัติ และนโยบายกำลังรอ QA",
  gdSWsPolicy1: "ขั้นจำลองถูกล็อก และเหตุผลชี้กลับมาที่การไม่มีนโยบาย",
  gdSWsPolicy2:
    "เมื่อสินค้ายังไม่มีนโยบายที่อนุมัติ การวิเคราะห์และการจำลองจะยังถูกล็อก",
  gdSWsPolicy3: "นโยบายอยู่ในสถานะรอทบทวน กำลังรอผู้ใช้ที่มีบทบาท QA มาอนุมัติ",
  gdAltWsAnalysis:
    "ผลการวิเคราะห์ มีป้ายช่วงเวลาที่ไม่ทราบ คำอธิบาย เวลาที่ไม่มีค่าอ่าน 2400 วินาที และกฎ R-DATA ที่ตรงเงื่อนไขซึ่งมีผลเป็น REVIEW_REQUIRED",
  gdSWsAnalysis1:
    "การจัดประเภท ช่วงเวลาที่ไม่ทราบ หมายความว่าเอนจินประเมินบางช่วงเวลาไม่ได้เพราะไม่มีค่าอ่าน",
  gdSWsAnalysis2:
    "ข้อความอธิบายตรง ๆ ว่าหมายถึงอะไร เวลาที่ไม่ทราบจะไม่ถูกนับว่าเป็นไปตามเกณฑ์",
  gdSWsAnalysis3:
    "เวลาที่ไม่มีค่าอ่าน แสดงเป็นวินาทีที่แน่นอน ตรงนี้ 2400 วินาทีคือช่วงที่ขาด 40 นาที",
  gdSWsAnalysis4:
    "กฎที่ตรงเงื่อนไขและผลของกฎ ในที่นี้คือ R-DATA ที่มีผลเป็น REVIEW_REQUIRED",
  gdWsPolNote:
    "หากต้องการวิเคราะห์ ให้เลือกชุดข้อมูลที่พร้อมใช้และนโยบายที่อนุมัติแล้ว แล้วกดวิเคราะห์หลักฐานที่ปักหมุดไว้ ผลลัพธ์จะผูกกับชุดข้อมูลและนโยบายนั้นโดยเฉพาะ",

  gdWsSimH: "ขั้นที่ 3 และ 4 จำลองและเสนอ",
  gdWsSimLead:
    "ขั้นจำลองใช้หน้าตาเดียวกับสตูดิโอ แต่ตัวเลขมาจากเอนจิน เอนจินตัดสินความเข้าเกณฑ์ก่อน แล้วจึงนำทางเลือกมาเทียบกันด้วยต้นทุนและความล่าช้า",
  gdAltWsSimulate:
    "ขั้นจำลอง มีรายการสถานการณ์พร้อมป้ายสถานะจากเอนจิน ฉากเส้นทาง การ์ดผลลัพธ์ที่เป็นข้อมูลไม่เพียงพอหรือต้องทบทวน กราฟค่าอ่านที่วัดได้ และตารางเปรียบเทียบ",
  gdSWsSimulate1:
    "ตอนนี้แต่ละสถานการณ์มีป้ายสถานะจากเอนจิน เช่น ข้อมูลไม่เพียงพอ หรือ ต้องทบทวน",
  gdSWsSimulate2: "ฉากเส้นทางแบบแผนผัง เหมือนในสตูดิโอ",
  gdSWsSimulate3:
    "การ์ดผลลัพธ์ ต้นทุนทางตรงจากระบบมีป้ายคำนวณแล้ว เหตุผลแสดงกฎที่อยู่เบื้องหลังสถานะ และระบุหลักฐานที่ขาด",
  gdSWsSimulate4:
    "ตารางเปรียบเทียบแสดงทุกสถานการณ์พร้อมสถานะ ต้นทุน และความล่าช้า ช่องคะแนนจัดอันดับแสดง Excluded เมื่อเอนจินไม่จัดอันดับทางเลือกนั้น",
  gdSWsSimulate5:
    "ปุ่มเตรียมข้อเสนอพาสถานการณ์ที่เลือกไปยังขั้นเสนอ ขั้นนั้นเปิดได้เฉพาะสถานการณ์ที่เข้าเกณฑ์หรือต้องทบทวน",
  gdWsSimNote:
    "เมื่อเปลี่ยนความล่าช้า ต้นทุน หรือสมมติฐานของผู้รับ ระบบจะคำนวณตัวอย่างใหม่ การบันทึกจะสร้างผลรันใหม่ และผลรันเดิมจะไม่ถูกเขียนทับ สถานการณ์ที่ถูกบล็อกเสนอไม่ได้ ส่วนสถานการณ์ที่ข้อมูลไม่เพียงพอต้องเพิ่มหลักฐานก่อน",
  gdAltWsPropose:
    "แบบฟอร์มข้อเสนอของการกักไว้เพื่อตรวจสอบที่มีสถานะต้องทบทวน เหตุผลจากกฎ ช่องเหตุผลประกอบ และปุ่มบันทึกร่างเพื่อทบทวน",
  gdSWsPropose1: "สถานการณ์ที่คุณเลือก พร้อมสถานะจากเอนจินและต้นทุน",
  gdSWsPropose2: "เหตุผล กฎทุกข้อที่ถูกตรวจ ผลของกฎ และว่าตรงเงื่อนไขหรือไม่",
  gdSWsPropose3: "อธิบายว่าทำไมนี่จึงเป็นการดำเนินการที่เหมาะสม",
  gdSWsPropose4:
    "บันทึกร่างเพื่อทบทวน ขั้นต่อไปคือส่งให้ QA และมีเพียงผู้ที่เขียนร่างเท่านั้นที่ส่งได้ การส่งจะล็อกหลักฐาน",

  gdWsQaH: "ขั้นที่ 5 และ 6 การทบทวนโดย QA และรายงาน",
  gdWsQaLead:
    "หลังส่งแล้ว หลักฐานจะกลายเป็นสแนปช็อตที่ล็อกไว้ ประกอบด้วยแฮชของชุดข้อมูล เวอร์ชันนโยบาย เวอร์ชันเอนจินและเทมเพลต และสถานการณ์ที่เลือก การแก้นโยบายหรือข้อมูลภายหลังไม่กระทบสแนปช็อตนี้",
  gdAltWsQa:
    "ขั้นทบทวนโดย QA มีการตัดสินใจที่รอ QA สแนปช็อตที่ล็อกไว้ และแบบฟอร์มทบทวนที่มีผลการทบทวน บันทึก ช่องยืนยัน และปุ่มยืนยันผลการทบทวน",
  gdSWsQa1: "สแนปช็อตที่ล็อกไว้ อ่านได้อย่างเดียว แสดงแฮชและเวอร์ชัน",
  gdSWsQa2:
    "ผลการทบทวน ขอให้แก้ไข ปฏิเสธข้อเสนอ หรืออนุมัติขั้นตอนภายใน เลือกได้เฉพาะ QA",
  gdSWsQa3: "บันทึกการทบทวนจะถูกเก็บไว้พร้อมผลการทบทวน",
  gdSWsQa4:
    "ยืนยันผลการทบทวน ระบบจะบันทึกบทบาท บันทึกข้อความ เอกสารอ้างอิงหลักฐาน และเวลาของคุณ",
  gdWsQaNote:
    "ผู้ที่ไม่มีบทบาท QA จะเห็นข้อเสนอแต่ไม่มีปุ่มทบทวน และเซิร์ฟเวอร์บังคับเรื่องนี้ ผู้เสนออนุมัติข้อเสนอของตัวเองไม่ได้ สถานการณ์ที่นโยบายบล็อกจะยังถูกบล็อก การอนุมัติของ QA บันทึกเฉพาะผลของขั้นตอนภายในเท่านั้น",
  gdAltWsReport:
    "ขั้นรายงานหลังอนุมัติ มีสแนปช็อตที่ล็อกไว้ ปุ่มรีเฟรชสถานะรายงาน และปุ่มดาวน์โหลด PDF",
  gdSWsReport1: "รายงานสร้างจากสแนปช็อตนี้ ไม่ใช้ข้อมูลที่ใหม่กว่า",
  gdSWsReport2: "หลังกดสร้างรายงาน PDF ให้รีเฟรชสถานะจนกว่าจะพร้อม",
  gdSWsReport3:
    "ดาวน์โหลด PDF ข้อความใน PDF ตามภาษาของหน้าจอ ไม่ว่าจะเป็นอังกฤษหรือไทย ส่วนข้อมูลในสแนปช็อตเหมือนกันทั้งสองภาษา",
  gdWsExplainP:
    "คุณสร้างคำอธิบายเป็นข้อความเพิ่มเติมสำหรับผลรันได้ตามต้องการ เป็นข้อความที่อธิบายผลจากเอนจิน ไม่ใช่ค่าที่คำนวณ และไม่เปลี่ยนความเข้าเกณฑ์",

  gdFaqH: "คำถามและวิธีแก้",
  gdFaq1Q: "ฉาก 3 มิติว่างเปล่า หรือบอกว่าแสดง 3 มิติไม่ได้",
  gdFaq1A:
    "เบราว์เซอร์สร้าง WebGL ไม่ได้ สตูดิโอจะสลับไปมุมมอง 2D ซึ่งมีสถานการณ์และหลักฐานเหมือนกัน คุณจะเลือก 2D เองจากปุ่มมุมกล้องก็ได้",
  gdFaq2Q: "กดเล่นแล้วไม่มีอะไรเกิดขึ้น และฉากกระโดดไปท้ายสุด",
  gdFaq2A:
    "ระบบของคุณตั้งค่าให้ลดการเคลื่อนไหว สตูดิโอจึงแสดงเฟรมสุดท้ายและปิดปุ่มเล่น ให้ใช้แถบเลื่อนไทม์ไลน์เพื่อดูตลอดเส้นทางแทน",
  gdFaq3Q: "ปุ่มลัดไม่ทำงาน",
  gdFaq3A:
    "ปุ่มลัดจะถูกข้ามขณะพิมพ์ในช่องกรอก และ Space จะไม่ทำงานเมื่อมีปุ่มหรือลิงก์ถูกโฟกัสอยู่ ลองคลิกที่ว่างบนหน้าแล้วกดใหม่",
  gdFaq4Q: "คำแนะนำและการเล่นอัตโนมัติหายไป",
  gdFaq4A:
    "เบราว์เซอร์จำไว้ว่าคุณเคยเห็นแล้ว ล้างข้อมูลเว็บไซต์ของหน้านี้เพื่อดูทัวร์ครั้งแรกอีกครั้ง หรือกดรีเซ็ต",
  gdFaq5Q: "ทำไมทุกทางเลือกในสตูดิโอเป็นยังไม่ได้ประเมิน",
  gdFaq5A:
    "สตูดิโอเป็นพื้นที่ทดลอง ไม่มีนโยบายและไม่มีผลรันจากเอนจิน จึงตัดสินความเข้าเกณฑ์ไม่ได้ หากต้องการผลจากเอนจินให้ใช้พื้นที่ทำงาน",
  gdFaq6Q: "อัปโหลด CSV ของฉันในสตูดิโอได้ไหม",
  gdFaq6A: "ไม่ได้ การอัปโหลดทำในพื้นที่ทำงาน ที่ขั้นหลักฐานของการจัดส่ง",
  gdFaq7Q: "ทำไมเป็นช่องว่างแทนที่จะเป็นเส้น",
  gdFaq7A:
    "ช่วงที่ไม่มีค่าอ่านคือช่วงที่ไม่ทราบ แอปไม่เติมข้อมูลให้และไม่นับว่าอยู่ในเกณฑ์",
  gdFaq8Q: "ลงชื่อเข้าใช้ไม่ได้ หรือเซสชันหมดอายุ",
  gdFaq8A:
    "ใช้ปุ่มลงชื่อเข้าใช้ด้วยผู้ให้บริการยืนยันตัวตนในหน้าพื้นที่ทำงาน โดยเปิดจากที่อยู่เดียวกับที่คุณเปิดแอป หากหน้าใดแจ้งว่าเซสชันสิ้นสุดแล้ว ให้ลงชื่อเข้าใช้ใหม่ หากแจ้งว่าบทบาทของคุณเปิดส่วนนั้นไม่ได้ ให้ขอผู้ดูแลระบบของหน่วยงานเปลี่ยนบทบาทให้",
  gdFaq9Q: "ขั้นตอนหนึ่งถูกล็อก ต้องทำอย่างไร",
  gdFaq9A:
    "อ่านเหตุผลใต้ขั้นนั้น สาเหตุที่พบบ่อยคือยังไม่มีชุดข้อมูลที่พร้อมใช้ ยังไม่มีนโยบายที่อนุมัติ ยังไม่ได้วิเคราะห์ ยังไม่ได้บันทึกผลรันการจำลอง หรือยังไม่ได้ส่งข้อเสนอ ทำขั้นก่อนหน้าให้เสร็จ การล็อกก็จะหายไป",
  gdFaq10Q: "สลับภาษาหรือธีมได้ไหม",
  gdFaq10A:
    "ได้ ใช้ปุ่ม EN และ ไทย กับปุ่มสว่างหรือมืดบนแถบด้านบน เบราว์เซอร์จะจำค่าที่เลือกไว้ และคู่มือนี้พร้อมภาพหน้าจอจะเปลี่ยนตาม",

  gdSafeH: "สิ่งที่เครื่องมือนี้ไม่ทำ",
  gdSafeP1:
    "Cold Chain Simulation Studio ช่วยให้คนชั่งน้ำหนักทางเลือกหลังเกิดปัญหาอุณหภูมิ เครื่องมือนี้ไม่ได้บอกว่าสินค้าขายต่อ ส่งต่อ หรือทิ้งได้",
  gdSafeP2:
    "ทางเลือกใดจะดำเนินต่อได้ ตัดสินโดยเอนจินที่ใช้นโยบายที่อนุมัติและมีเวอร์ชันเท่านั้น แล้วจึงให้ผู้ที่มีบทบาท QA บันทึกการตัดสินใจ ต้นทุนต่ำ ความล่าช้าสั้น หรือกราฟที่ดูเรียบร้อย ไม่เปลี่ยนสิ่งนี้",
  gdSafeP3:
    "ตัวเลขในสตูดิโอเป็นค่าประมาณเพื่อสาธิต ค่าอุณหภูมิจำกัดในภาพหน้าจอเป็นค่าทดสอบ ห้ามนำไปใช้เป็นเกณฑ์จริงกับสินค้าใดทั้งสิ้น",
};
