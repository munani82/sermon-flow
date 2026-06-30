import React, { useState } from 'react';
import { View, StyleSheet, Text, Pressable, ScrollView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { FileText, ArrowLeft, Trash2, Share2, CheckSquare, Square } from 'lucide-react-native';
import { getNotes, deleteNotes, SermonNote } from '@/services/bibleDb';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function NotesArchiveScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const [notes, setNotes] = useState<SermonNote[]>([]);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<number>>(new Set());

  // 화면이 포커스될 때마다 데이터베이스에서 노트를 로드합니다.
  useFocusEffect(
    React.useCallback(() => {
      loadNotes();
    }, [])
  );

  const loadNotes = async () => {
    const data = await getNotes();
    setNotes(data);
  };

  // 개별 노트 선택/해제
  const handleSelectNote = (id: number) => {
    setSelectedNoteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedNoteIds.size === notes.length) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(notes.map(n => n.id).filter((id): id is number => id !== undefined)));
    }
  };

  // 선택 삭제 처리
  const handleDeleteSelected = async () => {
    if (selectedNoteIds.size === 0) return;

    const performDelete = async () => {
      await deleteNotes(Array.from(selectedNoteIds));
      setSelectedNoteIds(new Set());
      loadNotes();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('선택한 노트를 정말로 삭제하시겠습니까?')) {
        await performDelete();
      }
    } else {
      Alert.alert(
        '노트 삭제',
        '선택한 노트를 정말로 삭제하시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          { text: '삭제', style: 'destructive', onPress: performDelete }
        ]
      );
    }
  };

  // 다중 선택된 노트를 합쳐서 PDF 내보내기 및 공유
  const handleExportPdf = async () => {
    const selectedNotes = notes.filter(n => n.id && selectedNoteIds.has(n.id));
    if (selectedNotes.length === 0) {
      alert('PDF로 생성할 노트를 하나 이상 선택해 주세요.');
      return;
    }

    // 날짜 오름차순 정렬
    const sortedNotes = [...selectedNotes].sort((a, b) => a.date.localeCompare(b.date));

    // HTML 결합 바디 구성
    let notesHtml = '';
    sortedNotes.forEach(note => {
      const formattedContent = note.content
        .split('\n')
        .map(line => `<p style="margin: 6px 0; font-size: 14px; line-height: 1.6; color: #334155;">${line || '&nbsp;'}</p>`)
        .join('');

      notesHtml += `
        <div style="margin-bottom: 40px; page-break-inside: avoid; border-bottom: 1px solid #E2E8F0; padding-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
            <h2 style="font-size: 20px; font-weight: 700; color: #0F172A; margin: 0;">${note.title}</h2>
            <span style="font-size: 12px; font-weight: 600; color: #64748B; background: #F1F5F9; padding: 4px 8px; border-radius: 4px;">${note.date}</span>
          </div>
          <div style="margin-top: 8px;">
            ${formattedContent}
          </div>
        </div>
      `;
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>설교 노트 통합 문서</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              padding: 40px;
              color: #1E293B;
              max-width: 800px;
              margin: 0 auto;
            }
            .header-main {
              border-bottom: 2px solid #007AFF;
              padding-bottom: 16px;
              margin-bottom: 30px;
              text-align: center;
            }
            .header-main h1 {
              font-size: 26px;
              color: #0F172A;
              margin: 0;
            }
            .header-main p {
              font-size: 13px;
              color: #64748B;
              margin: 4px 0 0 0;
            }
          </style>
        </head>
        <body>
          <div class="header-main">
            <h1>설교 노트 통합 문서</h1>
            <p>생성일: ${new Date().toISOString().split('T')[0]}</p>
          </div>
          ${notesHtml}
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        alert('이 플랫폼에서는 PDF 공유가 불가능합니다.');
      }
    } catch (error) {
      console.error('PDF 내보내기 실패:', error);
      alert('PDF 내보내기 도중 오류가 발생했습니다.');
    }
  };

  // 노트를 선택해서 메인 에디터로 다시 열기
  const handleLoadNote = (note: SermonNote) => {
    router.replace({
      pathname: '/',
      params: {
        noteId: note.id?.toString(),
        noteTitle: note.title,
        noteContent: note.content,
      },
    });
  };

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={22} color="#0F172A" />
          </Pressable>
          <Text style={styles.headerTitle}>설교 노트 보관함</Text>
        </View>

        <View style={styles.headerRight}>
          {notes.length > 0 && (
            <>
              <Pressable onPress={handleSelectAll} style={styles.headerIconBtn}>
                <Text style={styles.selectText}>
                  {selectedNoteIds.size === notes.length ? '전체해제' : '전체선택'}
                </Text>
              </Pressable>
              
              <Pressable
                onPress={handleDeleteSelected}
                disabled={selectedNoteIds.size === 0}
                style={[styles.headerIconBtn, selectedNoteIds.size === 0 && styles.disabledBtn]}
              >
                <Trash2 size={18} color={selectedNoteIds.size === 0 ? '#CBD5E1' : '#EF4444'} />
              </Pressable>
              
              <Pressable
                onPress={handleExportPdf}
                disabled={selectedNoteIds.size === 0}
                style={[styles.pdfButton, selectedNoteIds.size === 0 && styles.disabledPdfBtn]}
              >
                <Share2 size={16} color="#FFFFFF" />
                <Text style={styles.pdfButtonText}>PDF 통합 내보내기</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>

      {/* 바디 목록 */}
      <ScrollView contentContainerStyle={styles.listContainer} style={styles.scroll}>
        {notes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FileText size={48} color="#94A3B8" />
            <Text style={styles.emptyText}>저장된 설교 노트가 없습니다.</Text>
            <Text style={styles.emptySubText}>에디터 화면에서 작성 후 저장해 보세요.</Text>
          </View>
        ) : (
          notes.map((note) => {
            const isSelected = note.id ? selectedNoteIds.has(note.id) : false;
            return (
              <View
                key={note.id}
                style={[styles.noteCard, isSelected && styles.noteCardSelected]}
              >
                {/* 체크박스 영역 */}
                <Pressable
                  onPress={() => note.id && handleSelectNote(note.id)}
                  style={styles.checkboxArea}
                >
                  {isSelected ? (
                    <CheckSquare size={20} color="#007AFF" />
                  ) : (
                    <Square size={20} color="#94A3B8" />
                  )}
                </Pressable>

                {/* 본문 영역 */}
                <Pressable
                  onPress={() => handleLoadNote(note)}
                  style={styles.cardContent}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.noteTitle}>{note.title}</Text>
                    <Text style={styles.noteDate}>{note.date}</Text>
                  </View>
                  <Text style={styles.notePreview} numberOfLines={2}>
                    {note.content.substring(0, 150)}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconBtn: {
    padding: 6,
    borderRadius: 8,
  },
  selectText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  pdfButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  pdfButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  disabledPdfBtn: {
    backgroundColor: '#CBD5E1',
  },
  scroll: {
    flex: 1,
  },
  listContainer: {
    padding: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  emptySubText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  noteCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    overflow: 'hidden',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  noteCardSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F9FF',
  },
  checkboxArea: {
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    padding: 16,
    paddingLeft: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  noteTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginRight: 10,
  },
  noteDate: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  notePreview: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
});
