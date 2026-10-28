/**
 * Every artboard of the approved design, at its canvas size, and the
 * development route that renders the same thing from the real components.
 */
export interface Board {
  /** The artboard file in the design, without `.dc.html`. */
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** The candidate: a development-only page under /workbench/fidelity. */
  readonly route: string;
  /** Where production renders the same state, for checking a deployment. */
  readonly liveRoute?: string;
  /**
   * Why production deliberately no longer looks like this artboard. The board
   * is still measured and reported, but it does not fail the gate.
   */
  readonly departure?: string;
}

const board = (name: string, width: number, height: number): Board => ({
  name,
  width,
  height,
  route: `/workbench/fidelity/${name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`,
});

const RESUME_CONTENT =
  'POR-37: the design shows résumé content the new résumé no longer has (removed figures, reworded statements).';

export const BOARDS: readonly Board[] = [
  { ...board('Main', 1440, 900), liveRoute: '/' },
  { ...board('Mobile', 390, 844), liveRoute: '/' },
  {
    ...board('StateTopic', 1280, 800),
    departure:
      'POR-34: a topic is its own page, so its record (here the timeline) follows the introduction.',
  },
  {
    ...board('StateStreaming', 1280, 800),
    departure: RESUME_CONTENT,
  },
  {
    ...board('StateRichAnswer', 1280, 800),
    departure: RESUME_CONTENT,
  },
  {
    ...board('StateFollowUp', 1280, 800),
    departure: RESUME_CONTENT,
  },
  board('StateNoInfo', 1280, 800),
  board('StateError', 1280, 800),
  board('StateContact', 1280, 800),
  board('MobileDrawer', 390, 844),
  {
    ...board('MobileConversation', 390, 844),
    departure: RESUME_CONTENT,
  },
  board('Sidebar', 248, 900),
  board('WelcomeScreen', 760, 300),
  board('Composer', 760, 220),
  board('ComposerStates', 880, 860),
  board('SuggestedQuestions', 760, 200),
  {
    ...board('AssistantMessage', 860, 1560),
    departure:
      'POR-36: the résumé is cited once as "Resume", not once per section, so the sources fit one row.',
  },
  {
    ...board('ExperienceTimeline', 780, 1400),
    departure: RESUME_CONTENT,
  },
  {
    ...board('AchievementMetrics', 780, 380),
    departure:
      "POR-37: two of the design's figures are no longer on the résumé; WEBFI and Maison Modern fill their cards.",
  },
  {
    ...board('SkillCollection', 780, 500),
    departure: RESUME_CONTENT,
  },
  board('ProjectPreview', 780, 660),
  board('ContactCard', 780, 320),
];

/**
 * Motion is frozen in both renders, so a shot never lands mid-animation, and
 * the text caret is hidden, so a blink is never a difference.
 */
export const FREEZE_CSS =
  '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition:none!important;caret-color:transparent!important}';
