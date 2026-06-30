import * as SQLite from 'expo-sqlite';
import rawBibleData from '../../assets/ko_KO.json';
import { fetchOnlineVerse } from './gemini';

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

// 한글 66권 약칭 및 전체 이름 맵
export const BIBLE_BOOKS: Record<string, { abbrev: string; fullName: string }> = {
  '창': { abbrev: 'gn', fullName: '창세기' },
  '출': { abbrev: 'ex', fullName: '출애굽기' },
  '레': { abbrev: 'lv', fullName: '레위기' },
  '민': { abbrev: 'nm', fullName: '민수기' },
  '신': { abbrev: 'dt', fullName: '신명기' },
  '수': { abbrev: 'js', fullName: '여호수아' },
  '삿': { abbrev: 'jud', fullName: '사사기' },
  '룻': { abbrev: 'rt', fullName: '룻기' },
  '삼상': { abbrev: '1sm', fullName: '사무엘상' },
  '삼하': { abbrev: '2sm', fullName: '사무엘하' },
  '왕상': { abbrev: '1kgs', fullName: '열왕기상' },
  '왕하': { abbrev: '2kgs', fullName: '열왕기하' },
  '대상': { abbrev: '1ch', fullName: '역대상' },
  '대하': { abbrev: '2ch', fullName: '역대하' },
  '스': { abbrev: 'ezr', fullName: '에스라' },
  '느': { abbrev: 'ne', fullName: '느헤미야' },
  '에': { abbrev: 'et', fullName: '에스더' },
  '욥': { abbrev: 'job', fullName: '욥기' },
  '시': { abbrev: 'ps', fullName: '시편' },
  '잠': { abbrev: 'prv', fullName: '잠언' },
  '전': { abbrev: 'ec', fullName: '전도서' },
  '아': { abbrev: 'so', fullName: '아가' },
  '사': { abbrev: 'is', fullName: '이사야' },
  '렘': { abbrev: 'jr', fullName: '예레미야' },
  '애': { abbrev: 'lm', fullName: '예레미야애가' },
  '겔': { abbrev: 'ez', fullName: '에스겔' },
  '단': { abbrev: 'dn', fullName: '다니엘' },
  '호': { abbrev: 'ho', fullName: '호세아' },
  '욜': { abbrev: 'jl', fullName: '요엘' },
  '암': { abbrev: 'am', fullName: '아모스' },
  '오': { abbrev: 'ob', fullName: '오바디야' },
  '욘': { abbrev: 'jn', fullName: '요나' },
  '미': { abbrev: 'mi', fullName: '미가' },
  '나': { abbrev: 'na', fullName: '나훔' },
  '하': { abbrev: 'hk', fullName: '하박국' },
  '습': { abbrev: 'zp', fullName: '스바냐' },
  '학': { abbrev: 'hg', fullName: '학개' },
  '슥': { abbrev: 'zc', fullName: '스가랴' },
  '말': { abbrev: 'ml', fullName: '말라기' },
  '마': { abbrev: 'mt', fullName: '마태복음' },
  '막': { abbrev: 'mk', fullName: '마가복음' },
  '눅': { abbrev: 'lk', fullName: '누가복음' },
  '요': { abbrev: 'jo', fullName: '요한복음' },
  '행': { abbrev: 'act', fullName: '사도행전' },
  '롬': { abbrev: 'rm', fullName: '로마서' },
  '고전': { abbrev: '1co', fullName: '고린도전서' },
  '고후': { abbrev: '2co', fullName: '고린도후서' },
  '갈': { abbrev: 'gl', fullName: '갈라디아서' },
  '엡': { abbrev: 'eph', fullName: '에베소서' },
  '빌': { abbrev: 'ph', fullName: '빌립보서' },
  '골': { abbrev: 'cl', fullName: '골로새서' },
  '살전': { abbrev: '1ts', fullName: '데살로니가전서' },
  '살후': { abbrev: '2ts', fullName: '데살로니가후서' },
  '딤전': { abbrev: '1tm', fullName: '디모데전서' },
  '딤후': { abbrev: '2tm', fullName: '디모데후서' },
  '딛': { abbrev: 'tt', fullName: '디도서' },
  '몬': { abbrev: 'phm', fullName: '빌레몬서' },
  '히': { abbrev: 'hb', fullName: '히브리서' },
  '야': { abbrev: 'jm', fullName: '야고보서' },
  '벧전': { abbrev: '1pe', fullName: '베드로전서' },
  '벧후': { abbrev: '2pe', fullName: '베드로후서' },
  '요일': { abbrev: '1jo', fullName: '요한일서' },
  '요이': { abbrev: '2jo', fullName: '요한이서' },
  '요삼': { abbrev: '3jo', fullName: '요한삼서' },
  '유': { abbrev: 'jd', fullName: '유다서' },
  '계': { abbrev: 're', fullName: '요한계시록' }
};

// 도서명 입력값 정규화 (예: '요한', '요한복음' -> '요')
export function normalizeBookName(input: string): string | null {
  const name = input.trim();
  if (BIBLE_BOOKS[name]) return name;

  for (const [key, val] of Object.entries(BIBLE_BOOKS)) {
    if (val.fullName === name || val.fullName.startsWith(name)) {
      return key;
    }
  }
  return null;
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) return dbInstance;
  dbInstance = await SQLite.openDatabaseAsync('bible.db');
  return dbInstance;
}

// 데이터베이스 초기 생성 및 전체 성경 시딩
export async function initDatabase(): Promise<void> {
  try {
    const db = await getDb();
    
    // 테이블 생성 (성경 테이블 및 노트 테이블)
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

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL
      );
    `);

    // 전체 성경 구절 수 검사 (기존 31,000개 수준인지 체크)
    const countResult = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM bible;');
    const count = countResult?.count ?? 0;

    if (count < 30000) {
      console.log('성경 로컬 DB 시딩 시작 (전체 성경)...');
      await db.runAsync('DELETE FROM bible;');
      
      // JSON 데이터를 SQLite DB에 트랜잭션으로 고속 인서트
      await db.withTransactionAsync(async () => {
        for (const bookData of rawBibleData as any[]) {
          const abbrev = bookData.abbrev;
          const bookKey = Object.keys(BIBLE_BOOKS).find(key => BIBLE_BOOKS[key].abbrev === abbrev);
          if (!bookKey) continue;
          
          const bookInfo = BIBLE_BOOKS[bookKey];
          
          for (let cIdx = 0; cIdx < bookData.chapters.length; cIdx++) {
            const chapterNum = cIdx + 1;
            const chapter = bookData.chapters[cIdx];
            for (let vIdx = 0; vIdx < chapter.length; vIdx++) {
              const verseNum = vIdx + 1;
              const content = chapter[vIdx];
              
              // 개역개정(KRV)으로 삽입
              await db.runAsync(
                'INSERT INTO bible (translation, book, bookFull, chapter, verse, content) VALUES (?, ?, ?, ?, ?, ?);',
                ['KRV', bookKey, bookInfo.fullName, chapterNum, verseNum, content]
              );
              // 새번역(RNKSV)도 오프라인 지원을 위해 동일 데이터 복제 삽입
              await db.runAsync(
                'INSERT INTO bible (translation, book, bookFull, chapter, verse, content) VALUES (?, ?, ?, ?, ?, ?);',
                ['RNKSV', bookKey, bookInfo.fullName, chapterNum, verseNum, content]
              );
            }
          }
        }
      });
      console.log('성경 로컬 DB 시딩 완료 (전체 성경)!');
    }
  } catch (error) {
    console.error('SQLite 성경 DB 초기화 실패:', error);
  }
}

// 특정 구절 조회 (단일 구절)
export async function getVerse(
  translation: 'OFFLINE' | 'KRV' | 'RNKSV',
  book: string,
  chapter: number,
  verse: number
): Promise<string | null> {
  try {
    const cleanAbbr = normalizeBookName(book);
    if (!cleanAbbr) return null;
    const bookInfo = BIBLE_BOOKS[cleanAbbr];

    if (translation !== 'OFFLINE') {
      // 온라인 조회 시도 (개역개정 또는 새번역)
      const onlineText = await fetchOnlineVerse(translation, bookInfo.fullName, chapter, verse);
      if (onlineText) {
        return onlineText;
      }
      // 온라인 실패 또는 API 키 미설정 시 로컬 오프라인 데이터로 대체
      const localText = await getVerseOffline(cleanAbbr, chapter, verse);
      return localText ? `${localText} (온라인 키 미설정 - 개역한글 대체)` : null;
    }

    return await getVerseOffline(cleanAbbr, chapter, verse);
  } catch (error) {
    console.error('성경 구절 조회 오류:', error);
    return null;
  }
}

// 로컬 SQLite에서 오프라인 구절 조회 헬퍼
async function getVerseOffline(cleanAbbr: string, chapter: number, verse: number): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ content: string }>(
    'SELECT content FROM bible WHERE translation = "KRV" AND (book = ? OR bookFull LIKE ?) AND chapter = ? AND verse = ?;',
    [cleanAbbr, `${cleanAbbr}%`, chapter, verse]
  );
  return row?.content ?? null;
}

// 연속 구절 조회 (예: 1-3절)
export async function getVersesRange(
  translation: 'OFFLINE' | 'KRV' | 'RNKSV',
  book: string,
  chapter: number,
  startVerse: number,
  endVerse: number
): Promise<string | null> {
  try {
    const cleanAbbr = normalizeBookName(book);
    if (!cleanAbbr) return null;
    const bookInfo = BIBLE_BOOKS[cleanAbbr];

    if (translation !== 'OFFLINE') {
      // 온라인 조회 시도
      const onlineText = await fetchOnlineVerse(translation, bookInfo.fullName, chapter, startVerse, endVerse);
      if (onlineText) {
        return onlineText;
      }
      const localText = await getVersesRangeOffline(cleanAbbr, chapter, startVerse, endVerse);
      return localText ? `${localText} (온라인 키 미설정 - 개역한글 대체)` : null;
    }

    return await getVersesRangeOffline(cleanAbbr, chapter, startVerse, endVerse);
  } catch (error) {
    console.error('성경 연속 구절 조회 오류:', error);
    return null;
  }
}

async function getVersesRangeOffline(cleanAbbr: string, chapter: number, startVerse: number, endVerse: number): Promise<string | null> {
  const db = await getDb();
  const results = await db.getAllAsync<{ verse: number; content: string }>(
    'SELECT verse, content FROM bible WHERE translation = "KRV" AND (book = ? OR bookFull LIKE ?) AND chapter = ? AND verse >= ? AND verse <= ? ORDER BY verse ASC;',
    [cleanAbbr, `${cleanAbbr}%`, chapter, startVerse, endVerse]
  );

  if (results.length === 0) return null;
  return results.map(r => `${r.verse}절 ${r.content}`).join(' ');
}

// 키워드 및 범위 기반 성경 검색
export async function searchBible(
  translation: 'OFFLINE' | 'KRV' | 'RNKSV',
  query: string
): Promise<Array<{ book: string; bookFull: string; chapter: number; verse: number; content: string }>> {
  try {
    const db = await getDb();
    
    // 패턴 분석 예: '요 3:16' 또는 '창 1:1-3' 인지 판별
    const parsePattern = /([가-힣]+)\s*(\d+):(\d+)(?:\s*-\s*(\d+))?/;
    const match = parsePattern.exec(query.trim());

    if (match) {
      const book = match[1];
      const chapter = parseInt(match[2], 10);
      const startVerse = parseInt(match[3], 10);
      const endVerse = match[4] ? parseInt(match[4], 10) : startVerse;
      
      const cleanAbbr = normalizeBookName(book);
      if (!cleanAbbr) return [];

      const results = await db.getAllAsync<{ book: string; bookFull: string; chapter: number; verse: number; content: string }>(
        'SELECT book, bookFull, chapter, verse, content FROM bible WHERE translation = "KRV" AND (book = ? OR bookFull LIKE ?) AND chapter = ? AND verse >= ? AND verse <= ? ORDER BY verse ASC;',
        [cleanAbbr, `${cleanAbbr}%`, chapter, startVerse, endVerse]
      );
      
      // 온라인 버전이고 결과가 존재하면 실시간 구절 업데이트 시도
      if (translation !== 'OFFLINE' && results.length > 0) {
        const bookInfo = BIBLE_BOOKS[cleanAbbr];
        const onlineText = await fetchOnlineVerse(translation, bookInfo.fullName, chapter, startVerse, endVerse);
        if (onlineText) {
          return [{
            book: cleanAbbr,
            bookFull: bookInfo.fullName,
            chapter,
            verse: startVerse,
            content: onlineText
          }];
        }
      }
      return results;
    }

    // 일반 텍스트 키워드 검색
    const results = await db.getAllAsync<{ book: string; bookFull: string; chapter: number; verse: number; content: string }>(
      'SELECT book, bookFull, chapter, verse, content FROM bible WHERE translation = "KRV" AND (content LIKE ? OR bookFull LIKE ?) LIMIT 50;',
      [translation, `%${query}%`, `%${query}%`]
    );
    return results;
  } catch (error) {
    console.error('성경 검색 오류:', error);
    return [];
  }
}

// --- 설교 노트 저장 및 조회 로직 ---

export interface SermonNote {
  id?: number;
  title: string;
  content: string;
  date: string;
}

export async function saveNote(title: string, content: string, date: string, id?: number): Promise<void> {
  try {
    const db = await getDb();
    if (id) {
      await db.runAsync(
        'UPDATE notes SET title = ?, content = ?, date = ? WHERE id = ?;',
        [title, content, date, id]
      );
    } else {
      await db.runAsync(
        'INSERT INTO notes (title, content, date) VALUES (?, ?, ?);',
        [title, content, date]
      );
    }
  } catch (error) {
    console.error('노트 저장 실패:', error);
  }
}

export async function getNotes(): Promise<SermonNote[]> {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync<SermonNote>(
      'SELECT id, title, content, date FROM notes ORDER BY date DESC, id DESC;'
    );
    return rows;
  } catch (error) {
    console.error('노트 조회 실패:', error);
    return [];
  }
}

export async function deleteNotes(ids: number[]): Promise<void> {
  try {
    const db = await getDb();
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(',');
    await db.runAsync(`DELETE FROM notes WHERE id IN (${placeholders});`, ids);
  } catch (error) {
    console.error('노트 삭제 실패:', error);
  }
}

