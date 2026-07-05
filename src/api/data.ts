import type { DictionaryEntry } from './types';

/**
 * CC-CEDICT-style sample data for the mock adapter. Curated for the CN→EN translator
 * audience: polysemes, register traps, officialese, and domain terms (law, finance,
 * medicine, tech) alongside everyday vocabulary and chengyu.
 */
export const ENTRIES: DictionaryEntry[] = [
  {
    id: 'yinhang',
    simplified: '银行',
    traditional: '銀行',
    pinyin: 'yin2 hang2',
    frequencyRank: 620,
    hskLevel: 3,
    measureWords: ['家'],
    senses: [
      {
        glosses: ['bank', 'banking institution'],
        domain: 'finance',
        examples: [
          {
            zh: '她在一家外资银行工作。',
            pinyin: 'Tā zài yì jiā wàizī yínháng gōngzuò.',
            en: 'She works at a foreign-invested bank.',
          },
        ],
      },
    ],
  },
  {
    id: 'hetong',
    simplified: '合同',
    traditional: '合同',
    pinyin: 'he2 tong2',
    frequencyRank: 1150,
    hskLevel: 5,
    measureWords: ['份', '个'],
    senses: [
      {
        glosses: ['contract', 'agreement'],
        domain: 'law',
        examples: [
          {
            zh: '双方已于本周签署了合同。',
            pinyin: 'Shuāngfāng yǐ yú běn zhōu qiānshǔ le hétong.',
            en: 'The two parties signed the contract this week.',
          },
        ],
      },
    ],
  },
  {
    id: 'yisi',
    simplified: '意思',
    traditional: '意思',
    pinyin: 'yi4 si5',
    frequencyRank: 380,
    hskLevel: 2,
    senses: [
      { glosses: ['meaning', 'sense (of a word or utterance)'] },
      { glosses: ['idea', 'opinion', 'wish'] },
      { glosses: ['interest', 'fun ("有意思" = interesting)'], register: 'colloquial' },
      {
        glosses: ['token of appreciation', 'small gift (often euphemistic)'],
        register: 'colloquial',
        examples: [
          {
            zh: '这是我们的一点小意思，请务必收下。',
            pinyin: 'Zhè shì wǒmen de yìdiǎn xiǎo yìsi, qǐng wùbì shōuxià.',
            en: 'This is a small token of our appreciation — please do accept it.',
          },
        ],
      },
    ],
  },
  {
    id: 'da',
    simplified: '打',
    traditional: '打',
    pinyin: 'da3',
    frequencyRank: 150,
    hskLevel: 1,
    senses: [
      { glosses: ['to hit', 'to strike', 'to beat'] },
      { glosses: ['to play (a ball game)', 'to engage in (an activity)'] },
      {
        glosses: ['to make (a phone call)', 'to send'],
        examples: [
          {
            zh: '有问题请直接给我打电话。',
            pinyin: 'Yǒu wèntí qǐng zhíjiē gěi wǒ dǎ diànhuà.',
            en: 'If anything comes up, just call me directly.',
          },
        ],
      },
      { glosses: ['since', 'from (a point in time or place)'], register: 'colloquial' },
    ],
  },
  {
    id: 'fangbian',
    simplified: '方便',
    traditional: '方便',
    pinyin: 'fang1 bian4',
    frequencyRank: 980,
    hskLevel: 3,
    senses: [
      { glosses: ['convenient', 'to make convenient for', 'suitable'] },
      { glosses: ['to relieve oneself', 'to use the toilet (euphemism)'], register: 'colloquial' },
    ],
  },
  {
    id: 'guanxi',
    simplified: '关系',
    traditional: '關係',
    pinyin: 'guan1 xi4',
    frequencyRank: 210,
    hskLevel: 3,
    senses: [
      { glosses: ['relationship', 'relation', 'connection'] },
      { glosses: ['guanxi', 'personal connections', 'network of influence'] },
      {
        glosses: ['to concern', 'to have a bearing on'],
        examples: [
          {
            zh: '这关系到公司的长远发展。',
            pinyin: 'Zhè guānxì dào gōngsī de chángyuǎn fāzhǎn.',
            en: "This has a bearing on the company's long-term development.",
          },
        ],
      },
    ],
  },
  {
    id: 'mianzi',
    simplified: '面子',
    traditional: '面子',
    pinyin: 'mian4 zi5',
    frequencyRank: 2100,
    hskLevel: 5,
    senses: [
      { glosses: ['face (social standing, prestige)', 'reputation'] },
      { glosses: ['outer surface', 'facade'] },
    ],
  },
  {
    id: 'jingshen',
    simplified: '精神',
    traditional: '精神',
    pinyin: 'jing1 shen2',
    frequencyRank: 460,
    hskLevel: 4,
    senses: [
      { glosses: ['spirit', 'mind', 'consciousness'] },
      {
        glosses: ['gist', 'essence (of a directive or speech)'],
        register: 'formal',
        domain: 'politics',
        examples: [
          {
            zh: '各部门要认真学习会议精神。',
            pinyin: 'Gè bùmén yào rènzhēn xuéxí huìyì jīngshén.',
            en: 'All departments must earnestly study the spirit of the meeting.',
          },
        ],
      },
      { glosses: ['vigor', 'energy', 'lively (with 精神 jīngshen)'], register: 'colloquial' },
    ],
  },
  {
    id: 'bawo',
    simplified: '把握',
    traditional: '把握',
    pinyin: 'ba3 wo4',
    frequencyRank: 1450,
    hskLevel: 5,
    senses: [
      { glosses: ['to grasp', 'to seize (an opportunity)', 'to have a firm hold of'] },
      { glosses: ['assurance', 'certainty ("有把握" = to be confident of)'] },
    ],
  },
  {
    id: 'susong',
    simplified: '诉讼',
    traditional: '訴訟',
    pinyin: 'su4 song4',
    frequencyRank: 4200,
    measureWords: ['起', '场'],
    senses: [
      {
        glosses: ['lawsuit', 'litigation', 'legal action'],
        register: 'formal',
        domain: 'law',
        examples: [
          {
            zh: '公司决定对侵权方提起诉讼。',
            pinyin: 'Gōngsī juédìng duì qīnquán fāng tíqǐ sùsòng.',
            en: 'The company decided to bring a lawsuit against the infringing party.',
          },
        ],
      },
    ],
  },
  {
    id: 'zhongcai',
    simplified: '仲裁',
    traditional: '仲裁',
    pinyin: 'zhong4 cai2',
    frequencyRank: 6800,
    senses: [
      { glosses: ['arbitration', 'to arbitrate'], register: 'formal', domain: 'law' },
    ],
  },
  {
    id: 'qinquan',
    simplified: '侵权',
    traditional: '侵權',
    pinyin: 'qin1 quan2',
    frequencyRank: 5900,
    senses: [
      {
        glosses: ['to infringe (rights)', 'infringement', 'tort'],
        domain: 'law',
      },
    ],
  },
  {
    id: 'yuangao',
    simplified: '原告',
    traditional: '原告',
    pinyin: 'yuan2 gao4',
    frequencyRank: 7100,
    senses: [{ glosses: ['plaintiff', 'complainant'], domain: 'law' }],
  },
  {
    id: 'beigao',
    simplified: '被告',
    traditional: '被告',
    pinyin: 'bei4 gao4',
    frequencyRank: 5600,
    senses: [{ glosses: ['defendant', 'the accused'], domain: 'law' }],
  },
  {
    id: 'lvxing-fulfill',
    simplified: '履行',
    traditional: '履行',
    pinyin: 'lv3 xing2',
    frequencyRank: 3600,
    senses: [
      {
        glosses: ['to perform (a contract)', 'to fulfill (obligations)', 'to carry out'],
        register: 'formal',
        domain: 'law',
        examples: [
          {
            zh: '当事人应当按照约定全面履行自己的义务。',
            pinyin: 'Dāngshìrén yīngdāng ànzhào yuēdìng quánmiàn lǚxíng zìjǐ de yìwù.',
            en: 'The parties shall fully perform their obligations as agreed.',
          },
        ],
      },
    ],
  },
  {
    id: 'shengxiao',
    simplified: '生效',
    traditional: '生效',
    pinyin: 'sheng1 xiao4',
    frequencyRank: 5200,
    senses: [
      { glosses: ['to take effect', 'to enter into force', 'to become effective'], domain: 'law' },
    ],
  },
  {
    id: 'weiyue',
    simplified: '违约',
    traditional: '違約',
    pinyin: 'wei2 yue1',
    frequencyRank: 6200,
    senses: [
      { glosses: ['to breach a contract', 'breach of contract', 'to default'], domain: 'law' },
    ],
  },
  {
    id: 'peichang',
    simplified: '赔偿',
    traditional: '賠償',
    pinyin: 'pei2 chang2',
    frequencyRank: 3900,
    hskLevel: 6,
    senses: [
      {
        glosses: ['to compensate', 'to indemnify', 'compensation', 'damages'],
        domain: 'law',
      },
    ],
  },
  {
    id: 'gupiao',
    simplified: '股票',
    traditional: '股票',
    pinyin: 'gu3 piao4',
    frequencyRank: 1800,
    hskLevel: 6,
    measureWords: ['支', '只'],
    senses: [{ glosses: ['stock', 'share (in a company)'], domain: 'finance' }],
  },
  {
    id: 'huilv',
    simplified: '汇率',
    traditional: '匯率',
    pinyin: 'hui4 lv4',
    frequencyRank: 4700,
    senses: [
      {
        glosses: ['exchange rate'],
        domain: 'finance',
        examples: [
          {
            zh: '人民币汇率保持基本稳定。',
            pinyin: 'Rénmínbì huìlǜ bǎochí jīběn wěndìng.',
            en: 'The renminbi exchange rate has remained basically stable.',
          },
        ],
      },
    ],
  },
  {
    id: 'rongzi',
    simplified: '融资',
    traditional: '融資',
    pinyin: 'rong2 zi1',
    frequencyRank: 5300,
    senses: [
      { glosses: ['financing', 'to raise capital', 'fundraising'], domain: 'finance' },
    ],
  },
  {
    id: 'guanshui',
    simplified: '关税',
    traditional: '關稅',
    pinyin: 'guan1 shui4',
    frequencyRank: 5100,
    senses: [{ glosses: ['tariff', 'customs duty'], domain: 'trade' }],
  },
  {
    id: 'gongyinglian',
    simplified: '供应链',
    traditional: '供應鏈',
    pinyin: 'gong1 ying4 lian4',
    frequencyRank: 6500,
    senses: [{ glosses: ['supply chain'], domain: 'business' }],
  },
  {
    id: 'tanpan',
    simplified: '谈判',
    traditional: '談判',
    pinyin: 'tan2 pan4',
    frequencyRank: 2400,
    hskLevel: 5,
    measureWords: ['轮', '场'],
    senses: [
      { glosses: ['to negotiate', 'negotiation', 'talks'], domain: 'business' },
    ],
  },
  {
    id: 'yimiao',
    simplified: '疫苗',
    traditional: '疫苗',
    pinyin: 'yi4 miao2',
    frequencyRank: 4400,
    measureWords: ['支', '剂'],
    senses: [
      {
        glosses: ['vaccine'],
        domain: 'medicine',
        examples: [
          {
            zh: '该疫苗已进入三期临床试验。',
            pinyin: 'Gāi yìmiáo yǐ jìnrù sān qī línchuáng shìyàn.',
            en: 'The vaccine has entered phase III clinical trials.',
          },
        ],
      },
    ],
  },
  {
    id: 'linchuang',
    simplified: '临床',
    traditional: '臨床',
    pinyin: 'lin2 chuang2',
    frequencyRank: 5800,
    senses: [{ glosses: ['clinical'], domain: 'medicine' }],
  },
  {
    id: 'gaoxueya',
    simplified: '高血压',
    traditional: '高血壓',
    pinyin: 'gao1 xue4 ya1',
    frequencyRank: 7400,
    senses: [{ glosses: ['hypertension', 'high blood pressure'], domain: 'medicine' }],
  },
  {
    id: 'rengongzhineng',
    simplified: '人工智能',
    traditional: '人工智能',
    pinyin: 'ren2 gong1 zhi4 neng2',
    frequencyRank: 3300,
    senses: [{ glosses: ['artificial intelligence', 'AI'], domain: 'technology' }],
  },
  {
    id: 'suanfa',
    simplified: '算法',
    traditional: '算法',
    pinyin: 'suan4 fa3',
    frequencyRank: 6100,
    senses: [{ glosses: ['algorithm'], domain: 'technology' }],
  },
  {
    id: 'xinpian',
    simplified: '芯片',
    traditional: '芯片',
    pinyin: 'xin1 pian4',
    frequencyRank: 4900,
    measureWords: ['块', '枚'],
    senses: [
      { glosses: ['chip', 'semiconductor chip', 'integrated circuit'], domain: 'technology' },
    ],
  },
  {
    id: 'shujuku',
    simplified: '数据库',
    traditional: '數據庫',
    pinyin: 'shu4 ju4 ku4',
    frequencyRank: 6900,
    senses: [{ glosses: ['database'], domain: 'technology' }],
  },
  {
    id: 'huashetianzu',
    simplified: '画蛇添足',
    traditional: '畫蛇添足',
    pinyin: 'hua4 she2 tian1 zu2',
    frequencyRank: 9500,
    senses: [
      {
        glosses: [
          'to draw a snake and add feet — to ruin something by adding the superfluous',
          'to gild the lily',
        ],
        register: 'literary',
        domain: 'idiom',
      },
    ],
  },
  {
    id: 'wangyangbulao',
    simplified: '亡羊补牢',
    traditional: '亡羊補牢',
    pinyin: 'wang2 yang2 bu3 lao2',
    frequencyRank: 9800,
    senses: [
      {
        glosses: [
          'to mend the pen after losing sheep — to act belatedly but not too late',
          'better late than never',
        ],
        register: 'literary',
        domain: 'idiom',
      },
    ],
  },
  {
    id: 'shishiqiushi',
    simplified: '实事求是',
    traditional: '實事求是',
    pinyin: 'shi2 shi4 qiu2 shi4',
    frequencyRank: 5400,
    senses: [
      {
        glosses: ['to seek truth from facts', 'pragmatic', 'realistic and down-to-earth'],
        register: 'formal',
        domain: 'idiom',
      },
    ],
  },
  {
    id: 'yisibugou',
    simplified: '一丝不苟',
    traditional: '一絲不苟',
    pinyin: 'yi1 si1 bu4 gou3',
    frequencyRank: 9200,
    senses: [
      {
        glosses: ['meticulous', 'scrupulous about every detail', 'conscientious'],
        register: 'literary',
        domain: 'idiom',
      },
    ],
  },
  {
    id: 'kaopu',
    simplified: '靠谱',
    traditional: '靠譜',
    pinyin: 'kao4 pu3',
    frequencyRank: 8600,
    senses: [
      {
        glosses: ['reliable', 'dependable', 'plausible'],
        register: 'colloquial',
        examples: [
          {
            zh: '这个供应商挺靠谱的，从来不拖延交货。',
            pinyin: 'Zhège gōngyìngshāng tǐng kàopǔ de, cónglái bù tuōyán jiāohuò.',
            en: 'This supplier is pretty reliable — they never delay a delivery.',
          },
        ],
      },
    ],
  },
  {
    id: 'sajiao',
    simplified: '撒娇',
    traditional: '撒嬌',
    pinyin: 'sa1 jiao1',
    frequencyRank: 9000,
    senses: [
      {
        glosses: ['to act coquettishly', 'to play the child to get one’s way'],
        register: 'colloquial',
      },
    ],
  },
  {
    id: 'jianyu',
    simplified: '鉴于',
    traditional: '鑒於',
    pinyin: 'jian4 yu2',
    frequencyRank: 4600,
    senses: [
      {
        glosses: ['in view of', 'whereas', 'considering that'],
        register: 'formal',
        examples: [
          {
            zh: '鉴于上述情况，会议决定推迟发布。',
            pinyin: 'Jiànyú shàngshù qíngkuàng, huìyì juédìng tuīchí fābù.',
            en: 'In view of the above, the meeting decided to postpone the release.',
          },
        ],
      },
    ],
  },
  {
    id: 'zhiji',
    simplified: '之际',
    traditional: '之際',
    pinyin: 'zhi1 ji4',
    frequencyRank: 5000,
    senses: [
      {
        glosses: ['at the time of', 'on the occasion of', 'as (something occurs)'],
        register: 'literary',
      },
    ],
  },
  {
    id: 'zhengce',
    simplified: '政策',
    traditional: '政策',
    pinyin: 'zheng4 ce4',
    frequencyRank: 520,
    hskLevel: 5,
    measureWords: ['项', '个'],
    senses: [{ glosses: ['policy'], domain: 'politics' }],
  },
  {
    id: 'gaige',
    simplified: '改革',
    traditional: '改革',
    pinyin: 'gai3 ge2',
    frequencyRank: 750,
    hskLevel: 5,
    measureWords: ['项', '场'],
    senses: [{ glosses: ['reform', 'to reform'], domain: 'politics' }],
  },
  {
    id: 'huanjing',
    simplified: '环境',
    traditional: '環境',
    pinyin: 'huan2 jing4',
    frequencyRank: 440,
    hskLevel: 3,
    senses: [
      { glosses: ['environment', 'surroundings', 'circumstances'] },
    ],
  },
  {
    id: 'kechixufazhan',
    simplified: '可持续发展',
    traditional: '可持續發展',
    pinyin: 'ke3 chi2 xu4 fa1 zhan3',
    frequencyRank: 6700,
    senses: [
      { glosses: ['sustainable development'], register: 'formal', domain: 'politics' },
    ],
  },
  {
    id: 'tanzhonghe',
    simplified: '碳中和',
    traditional: '碳中和',
    pinyin: 'tan4 zhong1 he2',
    frequencyRank: 8800,
    senses: [
      { glosses: ['carbon neutrality'], domain: 'environment' },
    ],
  },
  {
    id: 'laobaixing',
    simplified: '老百姓',
    traditional: '老百姓',
    pinyin: 'lao3 bai3 xing4',
    frequencyRank: 1900,
    hskLevel: 5,
    senses: [
      {
        glosses: ['ordinary people', 'the general public', 'civilians'],
        register: 'colloquial',
      },
    ],
  },
  {
    id: 'ganbu',
    simplified: '干部',
    traditional: '幹部',
    pinyin: 'gan4 bu4',
    frequencyRank: 1300,
    senses: [
      { glosses: ['cadre', 'official', 'officer (in an organization)'], domain: 'politics' },
    ],
  },
  {
    id: 'danwei',
    simplified: '单位',
    traditional: '單位',
    pinyin: 'dan1 wei4',
    frequencyRank: 900,
    hskLevel: 4,
    senses: [
      { glosses: ['unit (of measure)'] },
      {
        glosses: ['work unit', 'danwei', 'employer (PRC institutional sense)'],
        examples: [
          {
            zh: '这份证明需要单位盖章。',
            pinyin: 'Zhè fèn zhèngmíng xūyào dānwèi gàizhāng.',
            en: 'This certificate needs to be stamped by your work unit.',
          },
        ],
      },
    ],
  },
  {
    id: 'hukou',
    simplified: '户口',
    traditional: '戶口',
    pinyin: 'hu4 kou3',
    frequencyRank: 3700,
    senses: [
      {
        glosses: ['household registration', 'hukou', 'registered residence'],
        domain: 'politics',
      },
    ],
  },
  {
    id: 'xiaokang',
    simplified: '小康',
    traditional: '小康',
    pinyin: 'xiao3 kang1',
    frequencyRank: 6300,
    senses: [
      {
        glosses: ['moderately prosperous', 'comfortably well-off (of a society or family)'],
        register: 'formal',
        domain: 'politics',
      },
    ],
  },
  {
    id: 'luoshi',
    simplified: '落实',
    traditional: '落實',
    pinyin: 'luo4 shi2',
    frequencyRank: 1700,
    senses: [
      {
        glosses: ['to implement', 'to carry out', 'to put into effect'],
        register: 'formal',
        domain: 'politics',
        examples: [
          {
            zh: '各地要切实落实各项惠民政策。',
            pinyin: 'Gèdì yào qièshí luòshí gè xiàng huìmín zhèngcè.',
            en: 'All localities must earnestly implement the policies benefiting the people.',
          },
        ],
      },
    ],
  },
  {
    id: 'tuijin',
    simplified: '推进',
    traditional: '推進',
    pinyin: 'tui1 jin4',
    frequencyRank: 2000,
    senses: [
      {
        glosses: ['to advance', 'to press ahead with', 'to push forward'],
        register: 'formal',
      },
    ],
  },
  {
    id: 'chutai',
    simplified: '出台',
    traditional: '出台',
    pinyin: 'chu1 tai2',
    frequencyRank: 4300,
    senses: [
      {
        glosses: ['to unveil (a policy)', 'to issue', 'to roll out officially'],
        register: 'formal',
        domain: 'politics',
      },
    ],
  },
  {
    id: 'yinggai',
    simplified: '应该',
    traditional: '應該',
    pinyin: 'ying1 gai1',
    frequencyRank: 190,
    hskLevel: 2,
    senses: [
      { glosses: ['should', 'ought to', 'must (deontic)'] },
      { glosses: ['probably', 'presumably (epistemic)'], register: 'colloquial' },
    ],
  },
  {
    id: 'wenti',
    simplified: '问题',
    traditional: '問題',
    pinyin: 'wen4 ti2',
    frequencyRank: 120,
    hskLevel: 2,
    measureWords: ['个', '道'],
    senses: [
      { glosses: ['question', 'problem', 'issue'] },
      { glosses: ['fault', 'defect ("出问题" = to go wrong)'] },
    ],
  },
  {
    id: 'fanyi',
    simplified: '翻译',
    traditional: '翻譯',
    pinyin: 'fan1 yi4',
    frequencyRank: 2600,
    hskLevel: 4,
    measureWords: ['个', '名'],
    senses: [
      {
        glosses: ['to translate', 'to interpret', 'translation'],
        examples: [
          {
            zh: '这份合同需要翻译成英文。',
            pinyin: 'Zhè fèn hétong xūyào fānyì chéng Yīngwén.',
            en: 'This contract needs to be translated into English.',
          },
        ],
      },
      { glosses: ['translator', 'interpreter'] },
    ],
  },
];
