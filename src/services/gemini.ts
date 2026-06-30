import { GoogleGenerativeAI } from '@google/generative-ai';

// 개발 서버 빌드 타임 환경변수(EXPO_PUBLIC_*) 또는 사용자 설정 키를 불러옵니다.
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

// 로컬 캐시/더미 해설 딕셔너리
const MOCK_THEOLOGICAL_DATABASE: Record<string, string> = {
  '요 3:16': `[요한복음 3:16 신학적/역사적 배경 - Gemini Mock]
- **역사적 문맥**: AD 85~90년경, 기독교가 초기 로마 사회 및 유대교와 본격적인 신학적 갈등을 겪던 시기이자, 영지주의(예수의 성육신 부인) 사상이 싹트던 에베소에서 쓰였습니다.
- **문학적 문맥**: 니고데모라는 바리새인 율법 학자와의 심야 비밀 대화에서 나온 결론적 핵심 구절로, 거듭남(영적 재탄생)을 설명하는 연장선상에 있습니다.
- **신학적 주제**: 
  1. *하나님의 사랑 (Agape)*: 심판의 주가 아닌 자기희생을 통한 구원의 주체로서의 사랑을 부각합니다.
  2. *독생자 (Monogenes)*: 유일무이하고 본질을 공유하는 아들이라는 의미로, 예수의 유일 신성을 확증합니다.
  3. *영원한 생명 (Zoe Aionios)*: 질적으로 변화된 하나님과의 영적인 연합 상태를 의미합니다.`,

  '창 1:1': `[창세기 1:1 신학적/역사적 배경 - Gemini Mock]
- **역사적 문맥**: 바벨론 포로기(BC 6세기경) 혹은 그 이전 이스라엘 제사장 전승에 의해 보존된 문서로 추정됩니다. 바벨론의 창조 신화(에누마 엘리쉬 등)가 다신교적이고 전쟁 중심이었던 것과 대조적으로, 유일신 하나님의 평화롭고 절대적인 주권을 선언합니다.
- **원어적 의미**:
  1. *태초에 (Bereshit)*: 시간의 시작뿐 아니라 하나님의 우주적 질서의 절대적 기원을 정의합니다.
  2. *하나님이 (Elohim)*: 장엄 복수형 명사를 사용하여 하나님의 전능성과 무한한 위엄을 표현합니다.
  3. *창조하시니라 (Bara)*: 오직 신적인 주체에만 쓰이는 단어로, 무(無)에서의 창조(Creatio ex nihilo)를 지칭합니다.`,
};

export async function analyzePassage(reference: string, passageText: string): Promise<string> {
  const cleanRef = reference.trim();
  
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API Key가 설정되지 않았습니다. Mock 데이터를 반환합니다.');
    
    // 키워드로 매칭 시도
    for (const key of Object.keys(MOCK_THEOLOGICAL_DATABASE)) {
      if (cleanRef.includes(key) || key.includes(cleanRef)) {
        return MOCK_THEOLOGICAL_DATABASE[key];
      }
    }
    
    // 기본 목업 응답
    return `[${reference} 신학적/역사적 배경 - Gemini Mock]
- **역사적 배경**: 본 구절은 고대 이스라엘 혹은 초기 기독교 공동체가 처한 독특한 문화적, 언어적 맥락 속에서 기록되었습니다.
- **신학적 성찰**: 
  1. 텍스트의 앞뒤 문맥을 통해 선포하고자 하는 하나님의 통치와 예수 그리스도의 구원 사역이 내포되어 있습니다.
  2. 오프라인 상태이거나 API 키가 설정되지 않아 로컬 인공지능 해설 뼈대를 출력 중입니다. (온라인 상태에서 API 키 연동 시 구절에 대한 실시간 주석 요약 및 역사적 의미를 즉시 조회할 수 있습니다.)`;
  }

  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const prompt = `성경 구절 "${reference}: ${passageText}"에 대해 다음의 세 가지 구조로 정교하게 분석하여 요약해 주세요. 친절하고 신학적인 깊이가 있는 어조를 사용하고 마크다운 포맷으로 작성해 주세요. 
    1. 이 구절이 쓰여진 역사적, 시대적, 지리적 배경
    2. 성경 내 문학적/신학적 앞뒤 문맥
    3. 핵심 단어/원어의 깊은 의미와 현대 설교적 적용점`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error: any) {
    console.error('Gemini API 분석 실패:', error);
    return `[Gemini API 연동 중 오류가 발생했습니다]\n오류 메시지: ${error.message || error}`;
  }
}

// 실시간 성경 구절 온라인 조회 API (Gemini 활용)
export async function fetchOnlineVerse(
  translation: 'KRV' | 'RNKSV',
  bookFull: string,
  chapter: number,
  startVerse: number,
  endVerse?: number
): Promise<string | null> {
  if (!GEMINI_API_KEY) {
    return null;
  }
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const translationName = translation === 'KRV' ? '개역개정' : '새번역';
    const rangeStr = endVerse && endVerse > startVerse ? `${startVerse}-${endVerse}절` : `${startVerse}절`;
    const prompt = `성경 "${bookFull} ${chapter}장 ${rangeStr}"의 [${translationName}] 번역본 본문만 딱 출력해 주세요.
    
    [핵심 규칙]
    1. 어떠한 앞뒤 설명(예: "네, 성경 구절입니다" 등)이나 따옴표, 마크다운 기호 없이 오직 성경 본문 텍스트만 한 줄로 출력해 주세요.
    2. 여러 절인 경우, 절 번호를 붙여서 출력해 주세요 (예: "1절 태초에... 2절 땅이...").
    3. 구절이 존재하지 않는다면 정확히 "존재하지 않음"이라고만 출력해 주세요.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();
    if (text === '존재하지 않음') return null;
    return text;
  } catch (error) {
    console.error('Gemini 성경 구절 실시간 조회 실패:', error);
    return null;
  }
}

