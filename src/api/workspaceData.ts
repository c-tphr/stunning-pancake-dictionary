/**
 * Demo documents for the Workspace mock adapter (`getRemoteDocument`). Every
 * sentence below is copied verbatim from a dictionary entry's stored example
 * in data.ts, so `translateSegments`' example-backed shortcut (src/api/mock.ts)
 * fires for every segment — the demo translations are the dictionary's own
 * real English, not generic filler.
 */

export const SOURCE_ONLY_DOC_ID = '00000000-0000-4000-8000-000000000001';
export const MIXED_DOC_ID = '00000000-0000-4000-8000-000000000002';

const PARAGRAPH_1_ZH =
  '双方已于本周签署了合同。公司决定对侵权方提起诉讼。当事人应当按照约定全面履行自己的义务。';
const PARAGRAPH_2_ZH = '人民币汇率保持基本稳定。鉴于上述情况，会议决定推迟发布。';
const PARAGRAPH_3_ZH = '各部门要认真学习会议精神。';

const PARAGRAPH_1_EN =
  'The two parties signed the contract this week. The company decided to bring a lawsuit against the infringing party. The parties shall fully perform their obligations as agreed.';
const PARAGRAPH_2_EN =
  'The renminbi exchange rate has remained basically stable. In view of the above, the meeting decided to postpone the release.';
const PARAGRAPH_3_EN = 'All departments must earnestly study the spirit of the meeting.';

export const SOURCE_ONLY_DOC_TEXT = [PARAGRAPH_1_ZH, PARAGRAPH_2_ZH, PARAGRAPH_3_ZH].join('\n');

export const MIXED_DOC_TEXT = [
  PARAGRAPH_1_ZH,
  PARAGRAPH_1_EN,
  PARAGRAPH_2_ZH,
  PARAGRAPH_2_EN,
  PARAGRAPH_3_ZH,
  PARAGRAPH_3_EN,
].join('\n');
