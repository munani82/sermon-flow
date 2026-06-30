import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, Pressable, Text, SafeAreaView, KeyboardAvoidingView, Platform, Keyboard, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Edit3, Type, Save, FolderOpen, Plus } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import DrawingCanvas from '@/components/DrawingCanvas';
import BibleSidebar from '@/components/BibleSidebar';
import { initDatabase, getVerse, getVersesRange, saveNote } from '@/services/bibleDb';

interface DetectedVerse {
  reference: string;
  text: string;
}

export default function HomeScreen() {
  const params = useLocalSearchParams<{ noteId?: string; noteContent?: string; noteTitle?: string }>();
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  
  const [noteId, setNoteId] = useState<number | undefined>(undefined);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteText, setNoteText] = useState('오늘의 설교 노트\n\n- 본문 말씀: 요 3:16 을 묵상하며...\n태초에 하나님이 세상을 지으셨습니다. 창 1:1-3 과 창 1:3 을 참고하세요.');
  const [translation, setTranslation] = useState<'OFFLINE' | 'KRV' | 'RNKSV'>('OFFLINE');
  const [detectedVerses, setDetectedVerses] = useState<DetectedVerse[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [canvasMode, setCanvasMode] = useState<'draw' | 'text'>('draw');

  // 1. 앱 기동 시 SQLite 데이터베이스 초기화
  useEffect(() => {
    const prepareDb = async () => {
      await initDatabase();
      setDbReady(true);
    };
    prepareDb();
  }, []);

  // 보관함에서 노트 선택 시 불러오기
  useEffect(() => {
    if (params.noteContent !== undefined) {
      setNoteText(params.noteContent);
      setNoteId(params.noteId ? parseInt(params.noteId, 10) : undefined);
      setNoteTitle(params.noteTitle || '');
    }
  }, [params]);

  // 2. 에디터 텍스트 또는 번역본 설정이 바뀌면 SQLite DB에서 매칭 구절 실시간 쿼리
  useEffect(() => {
    if (!dbReady) return;

    const scanAndQueryVerses = async () => {
      // 정규식 매칭: 한글(1-4글자) + 숫자 + 콜론 + 숫자 + (옵션: - 숫자) (예: 요 3:16, 창세 1:1-3)
      const regex = /([가-힣]{1,4})\s*(\d+):(\d+)(?:\s*-\s*(\d+))?/g;
      let match;
      const foundVerses: DetectedVerse[] = [];
      const uniqueRefs = new Set<string>();

      while ((match = regex.exec(noteText)) !== null) {
        const fullRef = match[0];
        const book = match[1];
        const chapter = parseInt(match[2], 10);
        const startVerse = parseInt(match[3], 10);
        const endVerse = match[4] ? parseInt(match[4], 10) : undefined;
        
        const key = `${translation}_${book}_${chapter}_${startVerse}_${endVerse || ''}`;
        if (!uniqueRefs.has(key)) {
          uniqueRefs.add(key);
          
          let verseContent = null;
          if (endVerse && endVerse > startVerse) {
            // 연속 구절 처리
            verseContent = await getVersesRange(translation, book, chapter, startVerse, endVerse);
          } else {
            // 단일 구절 처리
            verseContent = await getVerse(translation, book, chapter, startVerse);
          }

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

  // 노트 저장 처리
  const handleSaveNote = async () => {
    try {
      const firstLine = noteText.trim().split('\n')[0] || '';
      const finalTitle = firstLine.replace(/[#\-*\s]/g, '').trim().substring(0, 20) || '새로운 설교 노트';
      const currentDate = new Date().toISOString().split('T')[0];
      
      await saveNote(finalTitle, noteText, currentDate, noteId);
      alert(noteId ? '노트가 수정되었습니다.' : '노트가 저장되었습니다.');
    } catch (e) {
      alert('노트 저장 실패');
    }
  };

  // 새 노트 만들기
  const handleNewNote = () => {
    setNoteId(undefined);
    setNoteTitle('');
    setNoteText('오늘의 설교 노트\n\n- 본문 말씀: \n');
  };

  return (
    <SafeAreaView style={[styles.safeArea, isDarkMode && { backgroundColor: '#0F172A' }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      
      {/* 상단 앱바 헤더 */}
      <View style={[styles.header, isDarkMode && { backgroundColor: '#1E293B', borderBottomColor: '#334155' }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.appTitle, isDarkMode && { color: '#F8FAFC' }]}>SermonFlow</Text>
          
          {/* 토글 칸을 제목 정도 높이(헤더 좌측)로 이동 배치 */}
          <View style={[styles.modeToggleContainer, isDarkMode && { backgroundColor: '#334155' }]}>
            <Pressable
              onPress={() => setCanvasMode('draw')}
              style={[
                styles.modeToggleButton,
                canvasMode === 'draw' && (isDarkMode ? { backgroundColor: '#3B82F6' } : styles.activeModeButton)
              ]}
            >
              <Edit3 size={14} color={canvasMode === 'draw' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.modeToggleText, canvasMode === 'draw' && styles.activeModeText]}>필기 ✍️</Text>
            </Pressable>

            <Pressable
              onPress={() => setCanvasMode('text')}
              style={[
                styles.modeToggleButton,
                canvasMode === 'text' && (isDarkMode ? { backgroundColor: '#3B82F6' } : styles.activeModeButton)
              ]}
            >
              <Type size={14} color={canvasMode === 'text' ? '#FFFFFF' : '#64748B'} />
              <Text style={[styles.modeToggleText, canvasMode === 'text' && styles.activeModeText]}>타이핑 ⌨️</Text>
            </Pressable>
          </View>

          {!dbReady && (
            <View style={styles.dbStatusBadge}>
              <Text style={styles.dbStatusText}>DB 초기화 중...</Text>
            </View>
          )}
        </View>

        {/* 유틸 제어 버튼 */}
        <View style={styles.headerRight}>
          <Pressable onPress={handleNewNote} style={[styles.utilButton, isDarkMode && { backgroundColor: '#334155' }]}>
            <Plus size={18} color={isDarkMode ? '#94A3B8' : '#475569'} />
          </Pressable>
          <Pressable onPress={handleSaveNote} style={[styles.utilButton, isDarkMode && { backgroundColor: '#334155' }]}>
            <Save size={18} color={isDarkMode ? '#94A3B8' : '#475569'} />
          </Pressable>
          <Pressable onPress={() => router.push('/explore')} style={[styles.utilButton, isDarkMode && { backgroundColor: '#334155' }]}>
            <FolderOpen size={18} color={isDarkMode ? '#94A3B8' : '#475569'} />
          </Pressable>
        </View>
      </View>

      {/* 태블릿 분할 작업 화면 */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.mainContainer, isDarkMode && { backgroundColor: '#0F172A' }]}
      >
        {/* 좌측 70% 워크스페이스 */}
        <View style={[styles.leftPane, { position: 'relative' }, isDarkMode && { backgroundColor: '#0F172A' }]}>
          <TextInput
            style={[styles.editor, isDarkMode && { color: '#F1F5F9', backgroundColor: '#0F172A' }]}
            multiline
            placeholder="여기에 설교를 작성하세요. '요 3:16' 또는 '창 1:1'을 작성하면 오른쪽 본문 탭에 해당 성경 말씀이 오프라인 DB로부터 자동 로드됩니다."
            value={noteText}
            onChangeText={setNoteText}
            textAlignVertical="top"
            placeholderTextColor={isDarkMode ? '#475569' : '#94A3B8'}
            editable={true}
          />
          
          {/* 드로잉 캔버스 오버레이 (텍스트 편집과 펜슬 필기가 공존하도록 상시 활성화하되 터치 분할 처리) */}
          <View 
            style={[
              StyleSheet.absoluteFill, 
              { 
                zIndex: 5,
                backgroundColor: 'transparent'
              }
            ]} 
            pointerEvents="box-none"
          >
            <DrawingCanvas 
              isToolbarVisible={true} 
              isActive={true} 
              canvasMode={canvasMode}
              setCanvasMode={setCanvasMode}
            />
          </View>
        </View>

        {/* 우측 30% 사이드바 */}
        <View style={[styles.rightPane, isDarkMode && { backgroundColor: '#1E293B', borderLeftWidth: 1, borderLeftColor: '#334155' }]}>
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
  modeToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    gap: 2,
    marginLeft: 16,
  },
  modeToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modeToggleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  activeModeText: {
    color: '#FFFFFF',
  },
  activeModeButton: {
    backgroundColor: '#007AFF',
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
