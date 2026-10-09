import type { Genre } from '../types';

export const MEMBER_GROUPS: Record<string, string> = {
  taeyeon: 'girls-generation', gdragon: 'bigbang',
  'jung-kook': 'bts', jimin: 'bts', v: 'bts', jin: 'bts', rm: 'bts', jhope: 'bts', agustd: 'bts',
  jennie: 'blackpink', rose: 'blackpink', lisa: 'blackpink', jisoo: 'blackpink',
  hwasa: 'mamamoo', 'lee-suhyun': 'akmu', 'jo-yuri': 'izone', 'kwon-eunbi': 'izone', 'choi-yena': 'izone',
  'jeon-somi': 'ioi', chungha: 'ioi', hyuna: '4minute', sunmi: 'wondergirls', 'lee-hyori': 'finkl',
  taemin: 'shinee', baekhyun: 'exo', doh: 'exo', kai: 'exo', yerin: 'gfriend',
  'huh-yunjin': 'lesserafim', yves: 'loona', nct127: 'nct', nctdream: 'nct',
};

const mappings: [Genre[], string][] = [
  [['ballad'], 'limyoungwoong sung-sikyung paul-kim baek-jiyoung ailee kwoon lee-mujin roy-kim lee-seungchul kim-bumsoo park-hyoshin yoon-jongshin kim-dongryul kim-donghyun sgwannabe davichi lee-seunggi lee-sunhee urban-zakapa'],
  [['rnb'], 'bibi heize lee-hi crush dean sam-kim jay-park naul brown-eyed-soul sumin'],
  [['hiphop'], 'zico dindin changmo beenzino epik-high dynamicduo jessi lee-youngji'],
  [['rock'], 'day6 jannabi hyukoh silica-gel nell shin-haechul seo-taiji yoon-dohyun yb jaurim ftisland cnblue'],
  [['indie', 'folk'], 'baek-yerin bol4 10cm jukjae buskerbusker akmu'],
  [['folk', 'ballad'], 'kim-kwangseok lee-juck kim-dongryul'],
  [['trot'], 'songgain hong-jinyoung jang-yoonjung youngtak lee-chanwon jeong-dongwon'],
  [['dance'], 'koyote cool park-jinyoung rain psy kim-wansun uhm-junghwa park-jiyoon'],
];

export const BASE_GENRES = Object.fromEntries(mappings.flatMap(([genres, ids]) => ids.split(' ').map(id => [id, genres]))) as Record<string, Genre[]>;
export const GENRE_OVERRIDES: Record<string, Genre[]> = {
  '김범수': ['ballad', 'rnb'], '나얼': ['rnb', 'ballad'], '박효신': ['ballad', 'rnb'], '이수': ['ballad', 'rock'],
  '임재범': ['rock', 'ballad'], '김경호': ['rock', 'ballad'], '박완규': ['rock', 'ballad'],
  '윤하': ['rock', 'ballad'], '아이유': ['ballad', 'dance', 'rnb'], '이선희': ['ballad', 'folk'],
  '거미': ['ballad', 'rnb'], '린': ['ballad', 'rnb'], '박정현': ['rnb', 'ballad'], '소향': ['ballad', 'rnb', 'crossover'],
  '김조한': ['rnb', 'ballad'], '김현철': ['rnb', 'jazz'], '선우정아': ['indie', 'rnb', 'jazz'],
  '백예린': ['rnb', 'indie'], '조용필': ['rock', 'ballad', 'dance'], '스텔라장': ['indie', 'dance'],
  '브라운 아이드 소울': ['rnb', 'ballad'], '악뮤': ['folk', 'indie', 'dance'],
  '엠씨더맥스': ['rock', 'ballad'], '버즈': ['rock', 'ballad'], '부활': ['rock', 'ballad'],
  '성시경': ['ballad'], '양다일': ['rnb', 'ballad'], '박원': ['ballad', 'rnb'],
  '김필': ['ballad', 'folk'], '정준일': ['ballad', 'indie'], '이현': ['ballad'],
  '어반자카파': ['rnb', 'ballad'], '다비치': ['ballad'], '비투비': ['dance', 'ballad'], '빅뱅': ['dance', 'hiphop'], '방탄소년단': ['dance', 'hiphop'], '블락비': ['dance', 'hiphop'], '샤이니': ['dance', 'rnb'],
  '정세운': ['ballad', 'folk'], '디기리': ['hiphop'], '허니패밀리 디기리': ['hiphop'], '골드부다': ['hiphop', 'rnb'], 'DPR LIVE': ['hiphop', 'rnb'], '에프티아일랜드': ['rock', 'ballad'], '데이식스': ['rock', 'ballad'],
  '나훈아': ['trot', 'folk'], '심수봉': ['trot', 'ballad'], '최백호': ['folk', 'jazz'],
};

// Search member names without treating the member as an alias of the group's
// recording identity when resolving its songs.
export const GROUP_SEARCH_NAMES: Record<string, string[]> = {
  'redvelvet': ['아이린', '슬기', '웬디', '조이', '예리'],
  'twice': ['나연', '정연', '모모', '사나', '지효', '미나', '다현', '채영', '쯔위'],
  'ive': ['안유진', '장원영', '가을', '레이', '리즈', '이서'],
  'aespa': ['카리나', '윈터', '지젤', '닝닝'],
  'itzy': ['예지', '류진', '리아', '채령', '유나'],
  'nmixx': ['릴리', '해원', '설윤', '배이', '지우', '규진'],
  'newjeans': ['민지', '하니', '다니엘', '해린', '혜인'],
  'bts': ['정국', 'Jungkook', '지민', 'Jimin', '뷔', '김태형', '진', '김석진', 'RM', '알엠', '김남준', '제이홉', '슈가', 'Agust D'],
  'blackpink': ['제니', 'JENNIE', '로제', 'ROSÉ', 'ROSE', '리사', 'LISA', '지수', 'JISOO'],
  'bigbang': ['지드래곤', 'G-DRAGON', 'GD', '권지용', '태양', 'TAEYANG', '대성', '탑'],
  'girls-generation': ['태연', 'TAEYEON', '김태연', '윤아', '서현', '수영', '티파니', '효연', '써니', '유리'],
  'shinee': ['태민', 'TAEMIN', '온유', 'ONEW', '종현', '키', '민호'],
  'exo': ['백현', 'BAEKHYUN', '디오', 'D.O.', '도경수', '카이', 'KAI', '수호', '찬열', '세훈', '첸', '시우민'],
  'mamamoo': ['화사', 'HWASA', '솔라', '문별', '휘인'],
  'infinite': ['김성규', '성규', '엘', '남우현', '장동우', '이성열', '이성종'],
  'akmu': ['이수현', '이찬혁'],
  'lesserafim': ['허윤진', 'HUH YUNJIN', '김채원', '사쿠라', '홍은채', '카즈하'],
  'gfriend': ['예린', '유주', '소원', '신비', '은하', '엄지'],
};

// Verified with the live iTunes artist catalog and the singers' track lists.
export const VERIFIED_ITUNES_IDS: Record<string, number> = {
  'kr-kim-bumsoo': 549055025, 'kr-naul': 359617072, 'kr-park-hyoshin': 292946954, 'kr-isu': 574037859,
};
