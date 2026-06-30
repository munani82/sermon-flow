import * as SQLite from 'expo-sqlite';

export interface BibleVerse {
  translation: 'KRV' | 'RNKSV';
  book: string; // 요, 창, 마, 롬 등 약칭
  bookFull: string; // 요한복음, 창세기 등 전체 명칭
  chapter: number;
  verse: number;
  content: string;
}

// 로컬 DB 인스턴스 초기화용 변수
let dbInstance: SQLite.SQLiteDatabase | null = null;

// 더미 시드 데이터 (개역개정 & 새번역)
const SEED_VERSES: BibleVerse[] = [
  // 개역개정 (KRV)
  { translation: 'KRV', book: '요', bookFull: '요한복음', chapter: 3, verse: 16, content: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라' },
  { translation: 'KRV', book: '창', bookFull: '창세기', chapter: 1, verse: 1, content: '태초에 하나님이 천지를 창조하시니라' },
  { translation: 'KRV', book: '창', bookFull: '창세기', chapter: 1, verse: 2, content: '땅이 혼돈하고 공허하며 흑암이 깊음 위에 있고 하나님의 영은 수면 위에 운행하시니라' },
  { translation: 'KRV', book: '창', bookFull: '창세기', chapter: 1, verse: 3, content: '하나님이 이르시되 빛이 있으라 하시니 빛이 있었고' },
  { translation: 'KRV', book: '마', bookFull: '마태복음', chapter: 5, verse: 3, content: '심령이 가난한 자는 복이 있나니 천국이 그들의 것임이요' },
  { translation: 'KRV', book: '마', bookFull: '마태복음', chapter: 5, verse: 4, content: '애통하는 자는 복이 있나니 그들이 위로를 받을 것임이요' },
  { translation: 'KRV', book: '롬', bookFull: '로마서', chapter: 12, verse: 1, content: '그러므로 형제들아 내가 하나님의 모든 자비하심으로 너희를 권하노니 너희 몸을 하나님이 기뻐하시는 거룩한 산 제물로 드리라 이는 너희가 드릴 영적 예배니라' },
  { translation: 'KRV', book: '롬', bookFull: '로마서', chapter: 12, verse: 2, content: '너희는 이 세대를 본받지 말고 오직 마음을 새롭게 함으로 변화를 받아 하나님의 선하시고 기뻐하시고 온전하신 뜻이 무엇인지 분별하도록 하라' },

  // 새번역 (RNKSV)
  { translation: 'RNKSV', book: '요', bookFull: '요한복음', chapter: 3, verse: 16, content: '하나님이 세상을 이처럼 사랑하셔서 독생자를 주셨으니, 누구든지 그를 믿는 사람마다 멸망하지 않고 영생을 얻게 하려는 것이다.' },
  { translation: 'RNKSV', book: '창', bookFull: '창세기', chapter: 1, verse: 1, content: '태초에 하나님이 천지를 창조하셨다.' },
  { translation: 'RNKSV', book: '창', bookFull: '창세기', chapter: 1, verse: 2, content: '땅이 혼돈하고 공허하며, 어둠이 깊음 위에 있고, 하나님의 영은 물 위에 움직이고 계셨다.' },
  { translation: 'RNKSV', book: '창', bookFull: '창세기', chapter: 1, verse: 3, content: '하나님이 말씀하시기를 "빛이 생겨라" 하시니, 빛이 생겼다.' },
  { translation: 'RNKSV', book: '마', bookFull: '마태복음', chapter: 5, verse: 3, content: '마음이 가난한 사람은 복이 있다. 하늘 나라가 그들의 것이다.' },
  { translation: 'RNKSV', book: '마', bookFull: '마태복음', chapter: 5, verse: 4, content: '슬퍼하는 사람은 복이 있다. 그들이 위로를 받을 것이다.' },
  { translation: 'RNKSV', book: '롬', bookFull: '로마서', chapter: 12, verse: 1, content: '형제자매 여러분, 그러므로 나는 하나님의 자비하심을 힘입어 여러분에게 권합니다. 여러분의 몸을 하나님께서 기뻐하실 거룩한 산 제물로 드리십시오. 이것이 여러분이 드릴 합당한 예배입니다.' },
  { translation: 'RNKSV', book: '롬', bookFull: '로마서', chapter: 12, verse: 2, content: '여러분은 이 시대의 풍조를 본받지 말고, 마음을 새롭게 함으로 변화를 받아서, 하나님의 선하시고 기뻐하시고 온전하신 뜻이 무엇인지 분별하도록 하십시오.' },
];

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('bible.db');
  return dbInstance;
}

// 데이터베이스 초기 생성 및 시딩
export async function initDatabase(): Promise<void> {
  try {
    const db = await getDb();
    
    // 테이블 생성
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bible (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        translation TEXT NOT NULL,
        book TEXT NOT NULL,
        bookFull TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        content TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bible_lookup ON bible (translation, book, chapter, verse);
      CREATE INDEX IF NOT EXISTS idx_bible_search ON bible (content);
    `);

    // 데이터가 이미 들어있는지 검사
    const countResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM bible;');
    const count = countResult?.count ?? 0;

    if (count === 0) {
      console.log('성경 로컬 DB 시딩 시작...');
      
      // 벌크 인서트 트랜잭션 처리
      for (const v of SEED_VERSES) {
        await db.runAsync(
          'INSERT INTO bible (translation, book, bookFull, chapter, verse, content) VALUES (?, ?, ?, ?, ?, ?);',
          [v.translation, v.book, v.bookFull, v.chapter, v.verse, v.content]
        );
      }
      console.log('성경 로컬 DB 시딩 완료!');
    }
  } catch (error) {
    console.error('SQLite 성경 DB 초기화 실패:', error);
  }
}

// 특정 구절 조회 (단일 구절 또는 장 전체)
export async function getVerse(
  translation: 'KRV' | 'RNKSV',
  book: string,
  chapter: number,
  verse: number
): Promise<string | null> {
  try {
    const db = await getDb();
    // 약칭과 매칭을 맞추기 위해 입력값 다듬기 (예: '요한' -> '요', '요' -> '요')
    const bookAbbr = book.trim().substring(0, 2); // '요한' -> '요한', '창세' -> '창세' 등 처리하되 1~2자
    let cleanAbbr = bookAbbr;
    if (bookAbbr.startsWith('요')) cleanAbbr = '요';
    if (bookAbbr.startsWith('창')) cleanAbbr = '창';
    if (bookAbbr.startsWith('마')) cleanAbbr = '마';
    if (bookAbbr.startsWith('롬')) cleanAbbr = '롬';

    const row = await db.getFirstAsync<{ content: string }>(
      'SELECT content FROM bible WHERE translation = ? AND (book = ? OR bookFull LIKE ?) AND chapter = ? AND verse = ?;',
      [translation, cleanAbbr, `${cleanAbbr}%`, chapter, verse]
    );
    return row?.content ?? null;
  } catch (error) {
    console.error('성경 구절 조회 오류:', error);
    return null;
  }
}

// 키워드 기반 성경 검색
export async function searchBible(
  translation: 'KRV' | 'RNKSV',
  query: string
): Promise<Array<{ book: string; bookFull: string; chapter: number; verse: number; content: string }>> {
  try {
    const db = await getDb();
    
    // 패턴 분석 예: '요 3:16' 인지 '사랑' 인지 판별
    const parsePattern = /([가-힣]+)\s*(\d+):(\d+)/;
    const match = parsePattern.exec(query.trim());

    if (match) {
      const book = match[1];
      const chapter = parseInt(match[2], 10);
      const verse = parseInt(match[3], 10);
      
      const bookAbbr = book.trim().substring(0, 2);
      let cleanAbbr = bookAbbr;
      if (bookAbbr.startsWith('요')) cleanAbbr = '요';
      if (bookAbbr.startsWith('창')) cleanAbbr = '창';
      if (bookAbbr.startsWith('마')) cleanAbbr = '마';
      if (bookAbbr.startsWith('롬')) cleanAbbr = '롬';

      const results = await db.getAllAsync<{ book: string; bookFull: string; chapter: number; verse: number; content: string }>(
        'SELECT book, bookFull, chapter, verse, content FROM bible WHERE translation = ? AND (book = ? OR bookFull LIKE ?) AND chapter = ? AND verse = ?;',
        [translation, cleanAbbr, `${cleanAbbr}%`, chapter, verse]
      );
      return results;
    }

    // 일반 텍스트 키워드 검색
    const results = await db.getAllAsync<{ book: string; bookFull: string; chapter: number; verse: number; content: string }>(
      'SELECT book, bookFull, chapter, verse, content FROM bible WHERE translation = ? AND (content LIKE ? OR bookFull LIKE ?) LIMIT 50;',
      [translation, `%${query}%`, `%${query}%`]
    );
    return results;
  } catch (error) {
    console.error('성경 검색 오류:', error);
    return [];
  }
}
