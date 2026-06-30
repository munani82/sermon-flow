import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { BookOpen, Sparkles, Search, Check, RefreshCw } from 'lucide-react-native';
import { searchBible } from '@/services/bibleDb';
import { analyzePassage } from '@/services/gemini';

interface BibleSidebarProps {
  detectedVerses: Array<{ reference: string; text: string }>;
  onInsertVerse: (verseText: string) => void;
  translation: 'KRV' | 'RNKSV';
  onTranslationChange: (val: 'KRV' | 'RNKSV') => void;
}

interface BibleSearchResult {
  book: string;
  bookFull: string;
  chapter: number;
  verse: number;
  content: string;
}

export default function BibleSidebar({
  detectedVerses = [],
  onInsertVerse,
  translation,
  onTranslationChange,
}: BibleSidebarProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'search' | 'ai'>('preview');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BibleSearchResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  // 성경 검색 실행
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      const results = await searchBible(translation, searchQuery);
      setSearchResults(results);
    };

    const delayDebounceFn = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, translation]);

  // AI 분석 요청 실행
  const handleAiAnalyze = async () => {
    // 분석할 대상 구절 결정 (감지된 구절 중 첫 번째 구절 혹은 기본 요 3:16)
    const targetVerse = detectedVerses.length > 0 
      ? detectedVerses[0] 
      : { reference: '요 3:16', text: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라' };

    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const response = await analyzePassage(targetVerse.reference, targetVerse.text);
      setAiAnalysis(response);
    } catch (e) {
      setAiAnalysis('분석 도중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 탭 헤더 */}
      <View style={styles.tabHeader}>
        <Pressable
          onPress={() => setActiveTab('preview')}
          style={[styles.tabButton, activeTab === 'preview' && styles.activeTabButton]}
        >
          <BookOpen size={16} color={activeTab === 'preview' ? '#007AFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'preview' && styles.activeTabText]}>본문 미리보기</Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('search')}
          style={[styles.tabButton, activeTab === 'search' && styles.activeTabButton]}
        >
          <Search size={16} color={activeTab === 'search' ? '#007AFF' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>성경 검색</Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('ai')}
          style={[styles.tabButton, activeTab === 'ai' && styles.activeTabButton]}
        >
          <Sparkles size={16} color={activeTab === 'ai' ? '#FF9500' : '#64748B'} />
          <Text style={[styles.tabText, activeTab === 'ai' && styles.activeTabAiText]}>AI 해설</Text>
        </Pressable>
      </View>

      {/* 설정 바: 번역본 선택 */}
      <View style={styles.settingsBar}>
        <Text style={styles.settingsLabel}>역본 선택</Text>
        <View style={styles.toggleGroup}>
          <Pressable
            onPress={() => onTranslationChange('KRV')}
            style={[styles.toggleButton, translation === 'KRV' && styles.activeToggleButton]}
          >
            <Text style={[styles.toggleText, translation === 'KRV' && styles.activeToggleText]}>개역개정</Text>
          </Pressable>
          <Pressable
            onPress={() => onTranslationChange('RNKSV')}
            style={[styles.toggleButton, translation === 'RNKSV' && styles.activeToggleButton]}
          >
            <Text style={[styles.toggleText, translation === 'RNKSV' && styles.activeToggleText]}>새번역</Text>
          </Pressable>
        </View>
      </View>

      {/* 본문 콘텐츠 스크롤 영역 */}
      <ScrollView contentContainerStyle={styles.contentContainer} style={styles.scrollView}>
        {activeTab === 'preview' && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>자동 감지된 성경 구절 ({detectedVerses.length})</Text>
              <Text style={styles.sectionSubtitle}>노트 작성 중 본문 참조가 감지되면 자동으로 로드됩니다.</Text>
            </View>

            {detectedVerses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>에디터에 '요 3:16' 또는 '창 1:1'과 같이 구절을 입력해보세요.</Text>
              </View>
            ) : (
              detectedVerses.map((verse, index) => (
                <View key={index} style={styles.verseCard}>
                  <View style={styles.verseHeader}>
                    <Text style={styles.verseReference}>{verse.reference} ({translation === 'KRV' ? '개역개정' : '새번역'})</Text>
                    <Pressable
                      onPress={() => onInsertVerse(`\n[${verse.reference}] ${verse.text}\n`)}
                      style={styles.insertButton}
                    >
                      <Check size={12} color="#007AFF" />
                      <Text style={styles.insertButtonText}>본문 삽입</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.verseText}>{verse.text}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {activeTab === 'search' && (
          <View>
            <View style={styles.searchBar}>
              <Search size={18} color="#94A3B8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="장, 절 또는 키워드 검색 (예: 요 3:16, 사랑)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94A3B8"
              />
            </View>

            {searchResults.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>검색 결과가 없습니다. (예: '요 3:16', '사랑', '태초')</Text>
              </View>
            ) : (
              searchResults.map((verse, index) => {
                const refString = `${verse.bookFull} ${verse.chapter}:${verse.verse}`;
                return (
                  <View key={index} style={styles.verseCard}>
                    <View style={styles.verseHeader}>
                      <Text style={styles.verseReference}>{refString}</Text>
                      <Pressable
                        onPress={() => onInsertVerse(`\n[${refString}] ${verse.content}\n`)}
                        style={styles.insertButton}
                      >
                        <Check size={12} color="#007AFF" />
                        <Text style={styles.insertButtonText}>본문 삽입</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.verseText}>{verse.content}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}

        {activeTab === 'ai' && (
          <View>
            <View style={styles.aiHeader}>
              <Sparkles size={20} color="#FF9500" />
              <Text style={styles.aiTitle}>Gemini 신학적 배경 설명</Text>
            </View>
            <Text style={styles.aiSubtitle}>
              현재 감지되었거나 선택된 성경 구절의 주석, 신학적 해석, 역사적 배경을 AI가 정교하게 요약 분석합니다.
            </Text>

            <Pressable
              onPress={handleAiAnalyze}
              disabled={aiLoading}
              style={styles.aiButton}
            >
              {aiLoading ? (
                <RefreshCw size={16} color="#FFF" style={styles.loadingSpin} />
              ) : (
                <Sparkles size={16} color="#FFF" />
              )}
              <Text style={styles.aiButtonText}>
                {aiLoading ? '배경 분석 생성 중...' : 
                 detectedVerses.length > 0 
                   ? `"${detectedVerses[0].reference}" 배경 분석하기` 
                   : '기본 구절("요 3:16") 배경 분석하기'}
              </Text>
            </Pressable>

            {aiAnalysis && (
              <View style={styles.aiCard}>
                <Text style={styles.aiAnalysisText}>{aiAnalysis}</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: 1,
    borderLeftColor: '#E2E8F0',
  },
  tabHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: 8,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#007AFF',
  },
  activeTabAiText: {
    color: '#FF9500',
  },
  settingsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  settingsLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 2,
  },
  toggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeToggleButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  activeToggleText: {
    color: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  verseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  verseReference: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
  },
  insertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#E0F2FE',
    borderRadius: 6,
  },
  insertButtonText: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
  },
  verseText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    color: '#1E293B',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  aiTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  aiSubtitle: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF9500',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  aiButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  loadingSpin: {
    // Simple spinner representation or logic
  },
  aiCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    padding: 16,
  },
  aiAnalysisText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 22,
  },
});
