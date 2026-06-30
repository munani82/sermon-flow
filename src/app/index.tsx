import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Pressable, Text, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Edit3, Type, Save, Share2 } from 'lucide-react-native';
import DrawingCanvas from '@/components/DrawingCanvas';
import BibleSidebar from '@/components/BibleSidebar';
import { initDatabase, getVerse } from '@/services/bibleDb';

interface DetectedVerse {
  reference: string;
  text: string;
}

export default function HomeScreen() {
  const [noteText, setNoteText] = useState('오늘의 설교 노트\n\n- 본문 말씀: 요 3:16 을 묵상하며...\n태초에 하나님이 세상을 지으셨습니다. 창 1:1 과 창 1:3 을 참고하세요.');
  const [mode, setMode] = useState<'text' | 'draw'>('text');
  const [translation, setTranslation] = useState<'KRV' | 'RNKSV'>('KRV');
  const [detectedVerses, setDetectedVerses] = useState<DetectedVerse[]>([]);
  const [dbReady, setDbReady] = useState(false);

  // 1. 앱 기동 시 SQLite 데이터베이스 초기화
  useEffect(() => {
    const prepareDb = async () => {
      await initDatabase();
      setDbReady(true);
    };
    prepareDb();
  }, []);

  // 2. 에디터 텍스트 또는 번역본 설정이 바뀌면 SQLite DB에서 매칭 구절 실시간 쿼리
  useEffect(() => {
    if (!dbReady) return;

    const scanAndQueryVerses = async () => {
      // 정규식 매칭: 한글(1-4글자) + 숫자 + 콜론 + 숫자 (예: 요 3:16, 창세 1:1)
      const regex = /([가-힣]{1,4})\s*(\d+):(\d+)/g;
      let match;
      const foundVerses: DetectedVerse[] = [];
      const uniqueRefs = new Set<string>();

      while ((match = regex.exec(noteText)) !== null) {
        const fullRef = match[0];
        const book = match[1];
        const chapter = parseInt(match[2], 10);
        const verse = parseInt(match[3], 10);
        
        const key = `${translation}_${book}_${chapter}_${verse}`;
        if (!uniqueRefs.has(key)) {
          uniqueRefs.add(key);
          
          // SQLite 비동기 조회
          const verseContent = await getVerse(translation, book, chapter, verse);
          foundVerses.push({
            reference: fullRef,
            text: verseContent || '성경 구절을 불러올 수 없거나 DB에 존재하지 않습니다.',
          });
        }
      }
      setDetectedVerses(foundVerses);
    };

    scanAndQueryVerses();
  }, [noteText, translation, dbReady]);

  // 사이드바에서 본문 삽입 요청 시 처리
  const handleInsertVerse = (verseInsertion: string) => {
    setNoteText((prev) => prev + verseInsertion);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      
      {/* 상단 앱바 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.appTitle}>SermonFlow</Text>
          <Text style={styles.appSubtitle}>iPad 설교 작업실</Text>
          {!dbReady && (
            <View style={styles.dbStatusBadge}>
              <Text style={styles.dbStatusText}>DB 초기화 중...</Text>
            </View>
          )}
        </View>

        {/* 타이핑 / 드로잉 캔버스 스위치 */}
        <View style={styles.modeContainer}>
          <Pressable
            onPress={() => setMode('text')}
            style={[styles.modeButton, mode === 'text' && styles.activeModeButton]}
          >
            <Type size={16} color={mode === 'text' ? '#007AFF' : '#64748B'} />
            <Text style={[styles.modeText, mode === 'text' && styles.activeModeText]}>타이핑 모드</Text>
          </Pressable>

          <Pressable
            onPress={() => setMode('draw')}
            style={[styles.modeButton, mode === 'draw' && styles.activeModeButton]}
          >
            <Edit3 size={16} color={mode === 'draw' ? '#007AFF' : '#64748B'} />
            <Text style={[styles.modeText, mode === 'draw' && styles.activeModeText]}>펜슬 드로잉</Text>
          </Pressable>
        </View>

        {/* 유틸 제어 버튼 */}
        <View style={styles.headerRight}>
          <Pressable style={styles.utilButton}>
            <Save size={18} color="#475569" />
          </Pressable>
          <Pressable style={styles.utilButton}>
            <Share2 size={18} color="#475569" />
          </Pressable>
        </View>
      </View>

      {/* 태블릿 분할 작업 화면 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.mainContainer}
      >
        {/* 좌측 70% 워크스페이스 */}
        <View style={styles.leftPane}>
          {mode === 'text' ? (
            <TextInput
              style={styles.editor}
              multiline
              placeholder="여기에 설교를 작성하세요. '요 3:16' 또는 '창 1:1'을 작성하면 오른쪽 본문 탭에 해당 성경 말씀이 오프라인 DB로부터 자동 로드됩니다."
              value={noteText}
              onChangeText={setNoteText}
              textAlignVertical="top"
              placeholderTextColor="#94A3B8"
            />
          ) : (
            <View style={styles.canvasContainer}>
              {/* 스키아 드로잉 캔버스 컴포넌트 */}
              <DrawingCanvas />
              {/* 에디팅 텍스트 배경 오버레이 */}
              <View style={styles.canvasTextBackground} pointerEvents="none">
                <Text style={styles.bgTextPreview}>{noteText}</Text>
              </View>
            </View>
          )}
        </View>

        {/* 우측 30% 사이드바 */}
        <View style={styles.rightPane}>
          <BibleSidebar
            detectedVerses={detectedVerses}
            onInsertVerse={handleInsertVerse}
            translation={translation}
            onTranslationChange={setTranslation}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 64,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  appSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  dbStatusBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dbStatusText: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: '600',
  },
  modeContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  activeModeButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  activeModeText: {
    color: '#007AFF',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
  },
  utilButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPane: {
    flex: 7,
    backgroundColor: '#FFFFFF',
  },
  rightPane: {
    flex: 3,
  },
  editor: {
    flex: 1,
    padding: 24,
    fontSize: 16,
    color: '#1E293B',
    lineHeight: 28,
  },
  canvasContainer: {
    flex: 1,
    position: 'relative',
  },
  canvasTextBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 24,
    zIndex: -1,
    opacity: 0.15,
  },
  bgTextPreview: {
    fontSize: 16,
    color: '#000000',
    lineHeight: 28,
  },
});
